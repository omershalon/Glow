import ExpoModulesCore
import CoreML
import UIKit
import Accelerate

public class YoloDetectorModule: Module {
  private var mlModel: MLModel?
  private let modelInputSize: Int = 1280

  public func definition() -> ModuleDefinition {
    Name("YoloDetector")

    AsyncFunction("detect") { (imageUri: String, confidenceThreshold: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.runDetection(imageUri: imageUri, confidenceThreshold: Float(confidenceThreshold), promise: promise)
      }
    }
  }

  private func getModel() throws -> MLModel {
    if let cached = mlModel { return cached }

    guard let modelURL = Bundle.main.url(forResource: "yolo-acne", withExtension: "mlmodelc") else {
      guard let pkgURL = Bundle.main.url(forResource: "yolo-acne", withExtension: "mlpackage") else {
        throw NSError(domain: "YoloDetector", code: 1, userInfo: [NSLocalizedDescriptionKey: "Model file not found in bundle"])
      }
      let compiledURL = try MLModel.compileModel(at: pkgURL)
      let model = try MLModel(contentsOf: compiledURL)
      self.mlModel = model
      return model
    }

    let model = try MLModel(contentsOf: modelURL)
    self.mlModel = model
    return model
  }

  private func runDetection(imageUri: String, confidenceThreshold: Float, promise: Promise) {
    let startTime = CFAbsoluteTimeGetCurrent()

    guard let image = loadImage(from: imageUri) else {
      promise.reject("ERR_IMAGE", "Could not load image from URI: \(imageUri)")
      return
    }

    // Use UIImage.size (which respects EXIF orientation) for correct display coordinates.
    // cgImage.width/height ignore orientation and would produce misaligned bboxes.
    let imageWidth = Int(image.size.width * image.scale)
    let imageHeight = Int(image.size.height * image.scale)

    do {
      let model = try getModel()

      // Preprocess: resize to 1280x1280 and create CVPixelBuffer.
      // Draw via UIImage so the orientation is applied before inference.
      guard let pixelBuffer = preprocessImage(image: image) else {
        promise.reject("ERR_PREPROCESS", "Failed to preprocess image")
        return
      }

      // Run inference
      let inputName = model.modelDescription.inputDescriptionsByName.keys.first ?? "images"
      let input = try MLDictionaryFeatureProvider(dictionary: [inputName: MLFeatureValue(pixelBuffer: pixelBuffer)])
      let output = try model.prediction(from: input)

      let inferenceTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000

      // Parse output: end2end model outputs [1, 300, 6] as MLMultiArray
      // Each detection: [x1, y1, x2, y2, confidence, classIndex]
      let detections = parseEndToEndOutput(output: output, imageWidth: imageWidth, imageHeight: imageHeight, confidenceThreshold: confidenceThreshold)

      promise.resolve([
        "detections": detections,
        "imageWidth":  imageWidth,
        "imageHeight": imageHeight,
        "inferenceTimeMs": inferenceTime
      ])

    } catch {
      promise.reject("ERR_MODEL", "Model error: \(error.localizedDescription)")
    }
  }

  private func preprocessImage(image: UIImage) -> CVPixelBuffer? {
    let size = modelInputSize
    var pixelBuffer: CVPixelBuffer?
    let attrs: [String: Any] = [
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
    ]
    let status = CVPixelBufferCreate(kCFAllocatorDefault, size, size, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &pixelBuffer)
    guard status == kCVReturnSuccess, let buffer = pixelBuffer else { return nil }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: size,
      height: size,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { return nil }

    context.interpolationQuality = .high
    // Draw via UIGraphics so UIImage's EXIF orientation is applied.
    // Drawing cgImage directly ignores orientation, causing misaligned bboxes.
    UIGraphicsPushContext(context)
    image.draw(in: CGRect(x: 0, y: 0, width: size, height: size))
    UIGraphicsPopContext()
    return buffer
  }

  private func parseEndToEndOutput(output: MLFeatureProvider, imageWidth: Int, imageHeight: Int, confidenceThreshold: Float) -> [[String: Any]] {
    let classNames = ["blackheads", "dark spot", "nodules", "papules", "pustules", "whiteheads"]
    var detections: [[String: Any]] = []

    // Try to get the output MLMultiArray
    guard let outputName = output.featureNames.first(where: { _ in true }),
          let multiArray = output.featureValue(for: outputName)?.multiArrayValue else {
      return detections
    }

    let shape = multiArray.shape.map { $0.intValue }

    // End2end model: shape is [1, 300, 6] where 6 = [x1, y1, x2, y2, conf, classIdx]
    // Or shape might be [300, 6] after squeezing batch dim
    let numDetections: Int
    let valuesPerDetection: Int
    let batchOffset: Int

    if shape.count == 3 {
      // [1, 300, 6]
      numDetections = shape[1]
      valuesPerDetection = shape[2]
      batchOffset = 0
    } else if shape.count == 2 {
      // [300, 6]
      numDetections = shape[0]
      valuesPerDetection = shape[1]
      batchOffset = 0
    } else {
      return detections
    }

    guard valuesPerDetection >= 6 else { return detections }

    let ptr = multiArray.dataPointer.assumingMemoryBound(to: Float.self)
    let scaleX = Float(imageWidth) / Float(modelInputSize)
    let scaleY = Float(imageHeight) / Float(modelInputSize)

    for i in 0..<numDetections {
      let baseIdx: Int
      if shape.count == 3 {
        baseIdx = i * valuesPerDetection
      } else {
        baseIdx = i * valuesPerDetection
      }

      // YOLO output format: [x_center, y_center, width, height, confidence, class_id]
      // All coordinates are in model-input pixel space (0..1280).
      let cx         = ptr[baseIdx + 0]
      let cy         = ptr[baseIdx + 1]
      let bw         = ptr[baseIdx + 2]
      let bh         = ptr[baseIdx + 3]
      let confidence = ptr[baseIdx + 4]
      let classIdx   = Int(ptr[baseIdx + 5])

      // Skip low confidence or padding detections (end2end pads with zeros)
      guard confidence >= confidenceThreshold, classIdx >= 0, classIdx < classNames.count else { continue }

      // Convert center format → corner format, then scale to original image dimensions
      let scaledX1 = Double((cx - bw / 2) * scaleX)
      let scaledY1 = Double((cy - bh / 2) * scaleY)
      let scaledX2 = Double((cx + bw / 2) * scaleX)
      let scaledY2 = Double((cy + bh / 2) * scaleY)

      detections.append([
        "x1": scaledX1,
        "y1": scaledY1,
        "x2": scaledX2,
        "y2": scaledY2,
        "classIndex": classIdx,
        "className": classNames[classIdx],
        "confidence": Double(confidence)
      ])
    }

    return detections
  }

  private func loadImage(from uri: String) -> UIImage? {
    if uri.hasPrefix("file://") || uri.hasPrefix("/") {
      let path = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
      return UIImage(contentsOfFile: path)
    }
    guard let url = URL(string: uri), let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
  }
}
