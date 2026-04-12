package expo.modules.yolodetector

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.File
import java.io.FileInputStream
import java.nio.FloatBuffer
import java.util.Collections

class YoloDetectorModule : Module() {

    private var ortEnv: OrtEnvironment? = null
    private var ortSession: OrtSession? = null

    private val classNames = arrayOf(
        "blackheads", "dark spot", "nodules", "papules", "pustules", "whiteheads"
    )
    private val inputSize = 1280

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

    // ── Session initialisation ───────────────────────────────────────────────

    private fun getSession(): OrtSession {
        ortSession?.let { return it }

        val context = appContext.reactContext
            ?: throw Exception("React context not available")

        val env = OrtEnvironment.getEnvironment()
        ortEnv = env

        // Load model bytes from assets (merged from the AAR)
        val bytes = context.assets.open("yolo-acne.onnx").readBytes()
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(4)
            addNnapi()   // Android Neural Networks API (GPU/DSP acceleration)
        }
        val session = env.createSession(bytes, opts)
        ortSession = session
        return session
    }

    // ── Main detection ───────────────────────────────────────────────────────

    private fun runDetection(imageUri: String, confidenceThreshold: Float, promise: Promise) {
        val startTime = System.currentTimeMillis()

        val bitmap = loadBitmapWithOrientation(imageUri)
            ?: return promise.reject("ERR_IMAGE", "Could not load image: $imageUri")

        val imageWidth  = bitmap.width
        val imageHeight = bitmap.height

        // ── Pre-process ──────────────────────────────────────────────────────
        val resized = Bitmap.createScaledBitmap(bitmap, inputSize, inputSize, true)
        val pixels  = IntArray(inputSize * inputSize)
        resized.getPixels(pixels, 0, inputSize, 0, 0, inputSize, inputSize)

        // NCHW float32 [1, 3, 1280, 1280], normalised [0, 1]
        val floatBuf = FloatBuffer.allocate(1 * 3 * inputSize * inputSize)
        for (i in pixels.indices) {
            floatBuf.put(((pixels[i] shr 16) and 0xFF) / 255f)  // R
        }
        for (i in pixels.indices) {
            floatBuf.put(((pixels[i] shr 8)  and 0xFF) / 255f)  // G
        }
        for (i in pixels.indices) {
            floatBuf.put(( pixels[i]          and 0xFF) / 255f)  // B
        }
        floatBuf.rewind()

        // ── Inference ────────────────────────────────────────────────────────
        val session = getSession()
        val env     = ortEnv!!
        val inputName = session.inputNames.iterator().next()

        OnnxTensor.createTensor(
            env, floatBuf,
            longArrayOf(1, 3, inputSize.toLong(), inputSize.toLong())
        ).use { inputTensor ->

            val results = session.run(Collections.singletonMap(inputName, inputTensor))
            results.use {
                val outputTensor = results[0].value

                // Model output: [1, 300, 6] — [x1, y1, x2, y2, confidence, classIndex]
                // Coordinates are in model-input space (0..1280), scaled to image size.
                @Suppress("UNCHECKED_CAST")
                val raw = outputTensor as Array<Array<FloatArray>>
                val detections = buildDetections(
                    raw[0], imageWidth, imageHeight, confidenceThreshold
                )

                val inferenceTime = System.currentTimeMillis() - startTime
                promise.resolve(mapOf(
                    "detections"      to detections,
                    "imageWidth"      to imageWidth,
                    "imageHeight"     to imageHeight,
                    "inferenceTimeMs" to inferenceTime
                ))
            }
        }
    }

    // ── Post-processing ──────────────────────────────────────────────────────

    private fun buildDetections(
        output: Array<FloatArray>,
        imageWidth: Int,
        imageHeight: Int,
        threshold: Float
    ): List<Map<String, Any>> {
        val scaleX = imageWidth.toFloat()  / inputSize
        val scaleY = imageHeight.toFloat() / inputSize
        val result = mutableListOf<Map<String, Any>>()

        for (det in output) {
            // YOLO output format: [x_center, y_center, width, height, confidence, class_id]
            // All coordinates are in model-input pixel space (0..1280).
            val cx       = det[0]
            val cy       = det[1]
            val bw       = det[2]
            val bh       = det[3]
            val conf     = det[4]
            val classIdx = det[5].toInt()
            if (conf < threshold || classIdx < 0 || classIdx >= classNames.size) continue

            // Convert center format → corner format, then scale to original image dimensions
            result.add(mapOf(
                "x1"         to ((cx - bw / 2) * scaleX).toDouble(),
                "y1"         to ((cy - bh / 2) * scaleY).toDouble(),
                "x2"         to ((cx + bw / 2) * scaleX).toDouble(),
                "y2"         to ((cy + bh / 2) * scaleY).toDouble(),
                "classIndex" to classIdx,
                "className"  to classNames[classIdx],
                "confidence" to conf.toDouble()
            ))
        }
        return result
    }

    // ── Image loading ────────────────────────────────────────────────────────

    private fun loadBitmapWithOrientation(uri: String): Bitmap? {
        return try {
            val path = if (uri.startsWith("file://")) uri.substring(7) else uri
            val file = File(path)
            val bitmap = if (file.exists()) {
                BitmapFactory.decodeFile(file.absolutePath)
            } else {
                val ctx = appContext.reactContext ?: return null
                BitmapFactory.decodeStream(ctx.contentResolver.openInputStream(Uri.parse(uri)))
            } ?: return null

            val exif = try { ExifInterface(path) } catch (_: Exception) { return bitmap }
            val degrees = when (
                exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            ) {
                ExifInterface.ORIENTATION_ROTATE_90  ->  90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
            if (degrees == 0f) bitmap
            else Bitmap.createBitmap(
                bitmap, 0, 0, bitmap.width, bitmap.height,
                Matrix().apply { postRotate(degrees) }, true
            )
        } catch (_: Exception) { null }
    }
}
