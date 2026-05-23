import SwiftUI

struct LogoView: View {
    var size: CGFloat = 58

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.06, green: 0.46, blue: 0.43),
                            Color(red: 0.11, green: 0.31, blue: 0.85),
                            Color(red: 0.96, green: 0.62, blue: 0.04)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            RoundedRectangle(cornerRadius: size * 0.1, style: .continuous)
                .fill(Color.white.opacity(0.95))
                .frame(width: size * 0.64, height: size * 0.44)
                .offset(y: -size * 0.08)

            RoundedRectangle(cornerRadius: size * 0.06, style: .continuous)
                .fill(Color(red: 0.07, green: 0.2, blue: 0.23))
                .frame(width: size * 0.56, height: size * 0.1)
                .offset(y: size * 0.23)

            Image(systemName: "arrow.down")
                .font(.system(size: size * 0.34, weight: .black))
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color(red: 0.05, green: 0.64, blue: 0.62),
                            Color(red: 0.11, green: 0.31, blue: 0.85)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .offset(y: -size * 0.06)

            Image(systemName: "play.fill")
                .font(.system(size: size * 0.11, weight: .bold))
                .foregroundStyle(Color(red: 0.96, green: 0.62, blue: 0.04))
                .offset(x: size * 0.28, y: -size * 0.18)
        }
        .frame(width: size, height: size)
        .shadow(color: Color.black.opacity(0.18), radius: size * 0.16, y: size * 0.08)
    }
}
