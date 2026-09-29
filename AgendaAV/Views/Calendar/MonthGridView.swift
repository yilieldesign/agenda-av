import SwiftUI

struct MonthGridView: View {
    let month: Date
    let selectedDay: Date
    let occupancy: [Date: DayOccupancy]
    let onSelect: (Date) -> Void

    private let calendar = Calendar.current
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                ForEach(Array(calendar.orderedWeekdaySymbols().enumerated()), id: \.offset) { _, symbol in
                    Text(symbol.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }

            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(Array(calendar.monthGrid(for: month).enumerated()), id: \.offset) { _, date in
                    if let date {
                        DayCell(
                            date: date,
                            occupancy: occupancy[calendar.startOfDay(for: date)],
                            isSelected: calendar.isDate(date, inSameDayAs: selectedDay),
                            isToday: calendar.isDateInToday(date)
                        )
                        .onTapGesture { onSelect(date) }
                        .accessibilityLabel(accessibilityLabel(for: date))
                        .accessibilityAddTraits(calendar.isDate(date, inSameDayAs: selectedDay) ? .isSelected : [])
                    } else {
                        Color.clear
                            .frame(height: 48)
                    }
                }
            }
            .id(calendar.startOfMonth(for: month))
        }
    }

    private func accessibilityLabel(for date: Date) -> String {
        let dayText = date.formatted(.dateTime.weekday(.wide).day().month().locale(Locale(identifier: "es_DO")))
        guard let dayOccupancy = occupancy[calendar.startOfDay(for: date)] else {
            return "\(dayText), disponible"
        }
        if dayOccupancy.eventCount == 0 {
            return "\(dayText), disponible"
        }
        if dayOccupancy.hasMultipleCompanies {
            return "\(dayText), \(dayOccupancy.eventCount) trabajos de varias empresas"
        }
        return "\(dayText), ocupado, \(dayOccupancy.eventCount) trabajo\(dayOccupancy.eventCount == 1 ? "" : "s")"
    }
}

private struct DayCell: View {
    let date: Date
    let occupancy: DayOccupancy?
    let isSelected: Bool
    let isToday: Bool

    private var dayNumber: String {
        "\(Calendar.current.component(.day, from: date))"
    }

    var body: some View {
        VStack(spacing: 4) {
            Text(dayNumber)
                .font(.system(.body, design: .rounded).weight(isToday ? .bold : .medium))
                .foregroundStyle(isSelected ? Color.white : Color.primary)

            dots
        }
        .frame(maxWidth: .infinity)
        .frame(height: 48)
        .background(backgroundFill)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(borderColor, lineWidth: isSelected || isToday ? 2 : 0.5)
        }
    }

    @ViewBuilder
    private var dots: some View {
        let colors = occupancy?.companyColors ?? []
        if colors.isEmpty {
            Circle()
                .fill(.clear)
                .frame(width: 5, height: 5)
        } else if colors.count == 1 {
            Circle()
                .fill(isSelected ? Color.white : colors[0])
                .frame(width: 6, height: 6)
        } else {
            HStack(spacing: 2) {
                ForEach(Array(colors.prefix(3).enumerated()), id: \.offset) { _, color in
                    Circle()
                        .fill(isSelected ? Color.white.opacity(0.9) : color)
                        .frame(width: 5, height: 5)
                }
                if colors.count > 3 {
                    Text("+")
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(isSelected ? .white : .secondary)
                }
            }
        }
    }

    private var backgroundFill: Color {
        if isSelected {
            return Color.accentColor
        }
        let colors = occupancy?.companyColors ?? []
        if colors.count == 1 {
            return colors[0].opacity(0.22)
        }
        if colors.count > 1 {
            return Color.primary.opacity(0.06)
        }
        return AVStyle.availableFill
    }

    private var borderColor: Color {
        if isSelected { return Color.accentColor }
        if isToday { return AVStyle.todayRing.opacity(0.7) }
        let colors = occupancy?.companyColors ?? []
        if colors.count == 1 { return colors[0].opacity(0.35) }
        if occupancy?.isAvailable == true { return AVStyle.availableStroke }
        return Color.clear
    }
}
