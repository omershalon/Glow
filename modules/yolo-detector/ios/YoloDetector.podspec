require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'YoloDetector'
  s.version        = package['version']
  s.summary        = 'On-device YOLO object detection for skin analysis'
  s.description    = 'Expo native module for running YOLO inference on-device using CoreML'
  s.homepage       = 'https://github.com/glow/yolo-detector'
  s.license        = 'MIT'
  s.author         = 'Glow'
  s.source         = { :git => '' }

  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'

  s.source_files   = '**/*.{h,m,swift}'
  s.frameworks     = 'CoreML', 'Accelerate', 'UIKit'

  s.dependency 'ExpoModulesCore'
end
