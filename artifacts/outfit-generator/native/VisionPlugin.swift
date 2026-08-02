import Foundation
import Capacitor
import Vision
import UIKit

@objc(VisionPlugin)
public class VisionPlugin: CAPPlugin {

    /// Analyse an image data URL with Apple Vision.
    /// Returns { labels: [String], text: [String] } — always resolves, never rejects.
    @objc func analyzeImage(_ call: CAPPluginCall) {
        guard
            let dataUrl   = call.getString("dataUrl"),
            let commaIdx  = dataUrl.firstIndex(of: ",")
        else {
            call.resolve(["labels": [], "text": []])
            return
        }

        let b64  = String(dataUrl[dataUrl.index(after: commaIdx)...])
        guard
            let data    = Data(base64Encoded: b64, options: .ignoreUnknownCharacters),
            let uiImage = UIImage(data: data),
            let cgImage = uiImage.cgImage
        else {
            call.resolve(["labels": [], "text": []])
            return
        }

        // Run on a background queue — VNImageRequestHandler blocks the caller.
        DispatchQueue.global(qos: .userInitiated).async {
            var labels: [String] = []
            var texts:  [String] = []

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

            // Image classification
            let classifyReq = VNClassifyImageRequest { req, _ in
                guard let obs = req.results as? [VNClassificationObservation] else { return }
                labels = obs.filter { $0.confidence >= 0.3 }.map { $0.identifier }
            }

            // Text recognition (accurate mode)
            let textReq = VNRecognizeTextRequest { req, _ in
                guard let obs = req.results as? [VNRecognizedTextObservation] else { return }
                texts = obs.compactMap { $0.topCandidates(1).first?.string }
            }
            textReq.recognitionLevel = .accurate

            do {
                // perform() is synchronous — both callbacks have run when it returns
                try handler.perform([classifyReq, textReq])
            } catch {
                // fall through — labels/texts stay empty
            }

            call.resolve(["labels": labels, "text": texts])
        }
    }
}
