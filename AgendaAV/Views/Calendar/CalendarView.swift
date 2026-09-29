import SwiftData
import SwiftUI

struct CalendarView: View {
    @Query(sort: \WorkEvent.startDate) private var events: [WorkEvent]

    @State private var visibleMonth = Date.now.startOfDay
    @State private var selectedDay = Date.now.startOfDay
    @State private var editor: EventEditorRoute?

    private let calendar = Calendar.current

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    monthHeader
                    MonthGridView(
                        month: visibleMonth,
                        selectedDay: selectedDay,
                        occupancy: occupancy,
                        onSelect: selectDay
                    )
                    .padding(12)
                    .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
                    .shadow(color: .black.opacity(0.05), radius: 8, y: 2)

                    legend

                    DayAgendaView(
                        day: selectedDay,
                        events: eventsForSelectedDay,
                        onAdd: { editor = .create(day: selectedDay) },
                        onSelect: { editor = .edit($0) }
                    )
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Agenda")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        editor = .create(day: selectedDay)
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Agendar nuevo trabajo")
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hoy") {
                        visibleMonth = Date.now
                        selectedDay = Date.now.startOfDay
                    }
                }
            }
            .sheet(item: $editor) { route in
                AddEditEventView(route: route)
            }
        }
    }

    private var occupancy: [Date: DayOccupancy] {
        CalendarOccupancy.index(events: events, in: visibleMonth, calendar: calendar)
    }

    private var eventsForSelectedDay: [WorkEvent] {
        CalendarOccupancy.events(on: selectedDay, from: events, calendar: calendar)
    }

    private var monthHeader: some View {
        HStack {
            Button {
                shiftMonth(-1)
            } label: {
                Image(systemName: "chevron.left.circle.fill")
                    .font(.title2)
            }
            .accessibilityLabel("Mes anterior")

            Spacer()

            Text(visibleMonth.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "es_DO"))))
                .font(.title2.weight(.bold))

            Spacer()

            Button {
                shiftMonth(1)
            } label: {
                Image(systemName: "chevron.right.circle.fill")
                    .font(.title2)
            }
            .accessibilityLabel("Mes siguiente")
        }
        .foregroundStyle(.primary)
    }

    private var legend: some View {
        HStack(spacing: 16) {
            legendItem(color: AVStyle.availableFill, stroke: AVStyle.availableStroke, text: "Disponible")
            legendItem(color: Color.accentColor.opacity(0.2), stroke: Color.accentColor.opacity(0.4), text: "Ocupado")
            HStack(spacing: 4) {
                Circle().fill(Color.teal).frame(width: 7, height: 7)
                Circle().fill(Color.orange).frame(width: 7, height: 7)
                Text("Varias empresas")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func legendItem(color: Color, stroke: Color, text: String) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 3)
                .fill(color)
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(stroke))
                .frame(width: 12, height: 12)
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func selectDay(_ date: Date) {
        selectedDay = calendar.startOfDay(for: date)
        if !calendar.isDate(date, equalTo: visibleMonth, toGranularity: .month) {
            visibleMonth = date
        }
    }

    private func shiftMonth(_ value: Int) {
        if let next = calendar.date(byAdding: .month, value: value, to: visibleMonth) {
            visibleMonth = next
            if let clamped = clampSelectedDay(to: next) {
                selectedDay = clamped
            }
        }
    }

    private func clampSelectedDay(to month: Date) -> Date? {
        let day = calendar.component(.day, from: selectedDay)
        let start = calendar.startOfMonth(for: month)
        let maxDay = calendar.range(of: .day, in: .month, for: start)?.count ?? 28
        return calendar.date(byAdding: .day, value: min(day, maxDay) - 1, to: start)
    }
}

enum EventEditorRoute: Identifiable {
    case create(day: Date)
    case edit(WorkEvent)

    var id: String {
        switch self {
        case .create(let day): "create-\(day.timeIntervalSince1970)"
        case .edit(let event): "edit-\(event.uuid.uuidString)"
        }
    }
}

#Preview {
    CalendarView()
        .modelContainer(PreviewSampleData.container)
}
