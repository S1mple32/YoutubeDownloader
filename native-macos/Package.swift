// swift-tools-version: 6.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "native-macos",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "YtMark1Native",
            targets: ["native-macos"]
        )
    ],
    targets: [
        .executableTarget(
            name: "native-macos",
            resources: [
                .copy("Resources")
            ],
            linkerSettings: [
                .linkedFramework("SwiftUI"),
                .linkedFramework("WebKit")
            ]
        ),
        .testTarget(
            name: "native-macosTests",
            dependencies: ["native-macos"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
