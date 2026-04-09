package expo.modules.yolodetector

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.max
import kotlin.math.min

class YoloDetectorModule : Module() {
    private var interpreter: Interpreter? = null
    private val classNames = arrayOf("blackheads", "dark spot", "nodules", "papules", "pustules", "whiteheads")
    private val inputSize = 1280
    private val numClasses = 6
    private val iouThreshold = 0.45f

    override fun definition() = ModuleDefinition {
        Name("YoloDetector")

        AsyncFunction("detect") { imageUri: String, confidenceThreshold: Double, promise: Promise ->
            Thread {
                try {
                    runDetection(imageUri, confidenceThreshold.toFloat(), promise)
                } catch (e: Exception) {
                    promise.reject("ERR_DETECTION", e.message ?: "Detection failed", e)
                }
            }.start()
        }
    }

    private fun getInterpreter(): Interpreter {
        interpreter?.let { return it }

        val context = appContext.reactContext ?: throw Exception("React context not available")
        val modelBuffer = loadModelFile(context)

        val options = Interpreter.Options().apply {
            setNumThreads(4)
            try {
                addDelegate(GpuDelegate())
            } catch (e: Exception) {
                // GPU not available, fall back to CPU
            }
        }

        val interp = Interpreter(modelBuffer, options)
        interpreter = interp
        return interp
    }

    private fun loadModelFile(context: android.content.Context): MappedByteBuffer {
        val assetFd = context.assets.openFd("yolo-acne.tflite")
        val inputStream = FileInputStream(assetFd.fileDescriptor)
        val fileChannel = inputStream.channel
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, assetFd.startOffset, assetFd.declaredLength)
    }

    private fun runDetection(imageUri: String, confidenceThreshold: Float, promise: Promise) {
        val startTime = System.currentTimeMillis()

        // Load image
        val bitmap = loadBitmap(imageUri)
            ?: return promise.reject("ERR_IMAGE", "Could not load image from URI: $imageUri")

        val imageWidth = bitmap.width
        val imageHeight = bitmap.height

        // Resize to input size
        val resized = Bitmap.createScaledBitmap(bitmap, inputSize, inputSize, true)

        // Preprocess: convert to float32 RGB normalized [0, 1]
        val inputBuffer = ByteBuffer.allocateDirect(1 * 3 * inputSize * inputSize * 4).apply {
            order(ByteOrder.nativeOrder())
        }

        val pixels = IntArray(inputSize * inputSize)
        resized.getPixels(pixels, 0, inputSize, 0, 0, inputSize, inputSize)

        // YOLO expects CHW format: [1, 3, 1280, 1280]
        val rChannel = FloatArray(inputSize * inputSize)
        val gChannel = FloatArray(inputSize * inputSize)
        val bChannel = FloatArray(inputSize * inputSize)

        for (i in pixels.indices) {
            val pixel = pixels[i]
            rChannel[i] = ((pixel shr 16) and 0xFF) / 255.0f
            gChannel[i] = ((pixel shr 8) and 0xFF) / 255.0f
            bChannel[i] = (pixel and 0xFF) / 255.0f
        }

        for (v in rChannel) inputBuffer.putFloat(v)
        for (v in gChannel) inputBuffer.putFloat(v)
        for (v in bChannel) inputBuffer.putFloat(v)

        inputBuffer.rewind()

        // Run inference
        val interp = getInterpreter()

        // YOLO output shape: [1, numClasses + 4, numDetections]
        val outputShape = interp.getOutputTensor(0).shape()
        val numAttrs = outputShape[1]  // 4 + numClasses = 10
        val numDetections = outputShape[2]

        val outputBuffer = Array(1) { Array(numAttrs) { FloatArray(numDetections) } }
        interp.run(inputBuffer, outputBuffer)

        val inferenceTime = System.currentTimeMillis() - startTime

        // Post-process: decode detections
        val rawDetections = mutableListOf<FloatArray>() // [x1, y1, x2, y2, classIndex, confidence]
        val output = outputBuffer[0]

        for (i in 0 until numDetections) {
            val cx = output[0][i]
            val cy = output[1][i]
            val w = output[2][i]
            val h = output[3][i]

            // Find best class
            var maxScore = 0f
            var maxIdx = 0
            for (c in 0 until numClasses) {
                val score = output[4 + c][i]
                if (score > maxScore) {
                    maxScore = score
                    maxIdx = c
                }
            }

            if (maxScore < confidenceThreshold) continue

            // Convert from center format to corner format, scaled to original image
            val scaleX = imageWidth.toFloat() / inputSize
            val scaleY = imageHeight.toFloat() / inputSize
            val x1 = (cx - w / 2) * scaleX
            val y1 = (cy - h / 2) * scaleY
            val x2 = (cx + w / 2) * scaleX
            val y2 = (cy + h / 2) * scaleY

            rawDetections.add(floatArrayOf(x1, y1, x2, y2, maxIdx.toFloat(), maxScore))
        }

        // NMS
        val nmsResults = nms(rawDetections, iouThreshold)

        // Build output
        val detections = nmsResults.map { det ->
            val classIdx = det[4].toInt()
            mapOf(
                "x1" to det[0].toDouble(),
                "y1" to det[1].toDouble(),
                "x2" to det[2].toDouble(),
                "y2" to det[3].toDouble(),
                "classIndex" to classIdx,
                "className" to (classNames.getOrNull(classIdx) ?: "unknown"),
                "confidence" to det[5].toDouble()
            )
        }

        promise.resolve(mapOf(
            "detections" to detections,
            "imageWidth" to imageWidth,
            "imageHeight" to imageHeight,
            "inferenceTimeMs" to inferenceTime
        ))
    }

    private fun nms(detections: List<FloatArray>, iouThreshold: Float): List<FloatArray> {
        if (detections.isEmpty()) return emptyList()

        // Group by class
        val byClass = detections.groupBy { it[4].toInt() }
        val result = mutableListOf<FloatArray>()

        for ((_, dets) in byClass) {
            val sorted = dets.sortedByDescending { it[5] }.toMutableList()
            val keep = mutableListOf<FloatArray>()

            while (sorted.isNotEmpty()) {
                val best = sorted.removeAt(0)
                keep.add(best)
                sorted.removeAll { iou(best, it) > iouThreshold }
            }
            result.addAll(keep)
        }

        return result
    }

    private fun iou(a: FloatArray, b: FloatArray): Float {
        val x1 = max(a[0], b[0])
        val y1 = max(a[1], b[1])
        val x2 = min(a[2], b[2])
        val y2 = min(a[3], b[3])

        val intersection = max(0f, x2 - x1) * max(0f, y2 - y1)
        val areaA = (a[2] - a[0]) * (a[3] - a[1])
        val areaB = (b[2] - b[0]) * (b[3] - b[1])
        val union = areaA + areaB - intersection

        return if (union > 0) intersection / union else 0f
    }

    private fun loadBitmap(uri: String): Bitmap? {
        return try {
            val path = if (uri.startsWith("file://")) uri.substring(7) else uri
            val file = File(path)
            if (file.exists()) {
                BitmapFactory.decodeFile(file.absolutePath)
            } else {
                val context = appContext.reactContext ?: return null
                val stream = context.contentResolver.openInputStream(Uri.parse(uri))
                BitmapFactory.decodeStream(stream)
            }
        } catch (e: Exception) {
            null
        }
    }
}
