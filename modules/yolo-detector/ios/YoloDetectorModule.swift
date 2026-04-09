import ExpoModulesCore
import CoreML
import Vision
import UIKit
import Accelerate

public class YoloDetectorModule: Module {
  private var model: VNCoreMLModel?

  public func definition() -> ModuleDefinition {
    Name("YoloDetector")

    AsyncFunction("detect") { (imageUri: String, confidenceThreshold: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.runDetection(imageUri: imageUri, confidenceThreshold: Float(confidenceThreshold), promise: promise)
      }
    }
  }

  private func getModel() throws -> VNCoreMLModel {
    if let cached = model { return cached }

    guard let modelURL = Bundle.main.url(forResource: "yolo-acne", withExtension: "mlmodelc") else {
      // Try mlpackage
      guard let pkgURL = Bundle.main.url(forResource: "yolo-acne", withExtension: "mlpackage") else {
        throw NSError(domain: "YoloDetector", code: 1, userInfo: [NSLocalizedDescriptionKey: "Model file not found in bundle"])
      }
      let compiledURL = try MLModel.compileModel(at: pkgURL)
      let mlModel = try MLModel(contentsOf: compiledURL)
      let vnModel = try VNCoreMLModel(for: mlModel)
      self.model = vnModel
      return vnModel
    }

    let mlModel = try MLModel(contentsOf: modelURL)
    let vnModel = try VNCoreMLModel(for: mlModel)
    self.model = vnModel
    return vnModel
  }

  private func runDetection(imageUri: String, confidenceThreshold: Float, promise: Promise) {
    let startTime = CFAbsoluteTimeGetCurrent()

    // Load image
    guard let image = loadImage(from: imageUri) else {
      promise.reject("ERR_IMAGE", "Could not load image from URI: \(imageUri)")
      return
    }

    guard let cgImage = image.cgImage else {
      promise.reject("ERR_IMAGE", "Could not get CGImage")
      return
    }

    let imageWidth = cgImage.width
    let imageHeight = cgImage.height

    do {
      let vnModel = try getModel()

      let request = VNCoreMLRequest(model: vnModel) { request, error in
        if let error = error {
          promise.reject("ERR_INFERENCE", "Inference failed: \(error.localizedDescription)")
          return
        }

        let inferenceTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000

        guard let results = request.results as? [VNRecognizedObjectObservation] else {
          promise.resolve([
            "detections": [] as [[String: Any]],
            "imageWidth": imageWidth,
            "imageHeight": imageHeight,
            "inferenceTimeMs": inferenceTime
          ])
          return
        }

        let classNames = ["blackheads", "dark spot", "nodules", "papules", "pustules", "whiteheads"]
        var detections: [[String: Any]] = []

        for observation in results {
          guard let topLabel = observation.labels.first,
                observation.confidence >= confidenceThreshold else { continue }

          let classIndex = classNames.firstIndex(of: topLabel.identifier) ?? -1

          // VNRecognizedObjectObservation bbox is normalized with origin at bottom-left
          let box = observation.boundingBox
          let x1 = box.origin.x * CGFloat(imageWidth)
          let y1 = (1.0 - box.origin.y - box.height) * CGFloat(imageHeight)
          let x2 = (box.origin.x + box.width) * CGFloat(imageWidth)
          let y2 = (1.0 - box.origin.y) * CGFloat(imageHeight)

          detections.append([
            "x1": Double(x1),
            "y1": Double(y1),
            "x2": Double(x2),
            "y2": Double(y2),
            "classIndex": classIndex,
            "className": topLabel.identifier,
            "confidence": Double(observation.confidence)
          ])
        }

        promise.resolve([
          "detections": detections,
          "imageWidth": imageWidth,
          "imageHeight": imageHeight,
          "inferenceTimeMs": inferenceTime
        ])
      }

      request.imageCropAndScaleOption = .scaleFill

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try handler.perform([request])

    } catch {
      promise.reject("ERR_MODEL", "Model error: \(error.localizedDescription)")
    }
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
