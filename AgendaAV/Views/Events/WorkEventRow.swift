import SwiftUI

struct WorkEventRow: View {
    let event: WorkEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(event.company?.color ?? .gray)
                .frame(width: 5)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(event.projectName)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    Spacer()
                    Text(CurrencyFormat.string(from: event.billedAmount))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                }

                HStack(spacing: 6) {
                    if let company = event.company {
                        Text(company.name)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if event.isMultiDay {
                        Text("·")
                            .foregroundStyle(.tertiary)
                        Text(dateRangeText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                PaymentBadge(status: event.paymentStatus)
            }
        }
        .padding(.vertical, 4)
    }

    private var dateRangeText: String {
        let start = event.startDate.formatted(.dateTime.day().month(.abbreviated))
        let end = event.endDate.formatted(.dateTime.day().month(.abbreviated))
        return "\(start) – \(end)"
    }
}

struct PaymentBadge: View {
    let status: PaymentStatus

    var body: some View {
        Label(status.title, systemImage: status.systemImage)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(status == .paid ? Color.green : Color.orange)
            .background((status == .paid ? Color.green : Color.orange).opacity(0.12))
            .clipShape(Capsule())
    }
}
