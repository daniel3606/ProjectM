Pod::Spec.new do |s|
  s.name           = 'ScreenTime'
  s.version        = '0.1.0'
  s.summary        = 'Expo module wrapping Apple Screen Time (FamilyControls + ManagedSettings)'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'marshmallow'
  s.homepage       = 'https://github.com/placeholder'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
