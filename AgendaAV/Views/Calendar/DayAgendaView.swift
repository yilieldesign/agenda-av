import SwiftUI

struct DayAgendaView: View {
    let day: Date
    let events: [WorkEvent]
    let onAdd: () -> Void
    let onSelect: (WorkEvent) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(day.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "es_DO"))))
                        .font(.title3.weight(.semibold))
                    Text(events.isEmpty ? "Día disponible" : "\(events.count) trabajo\(events.count == 1 ? "" : "s")")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }

            if events.isEmpty {
                ContentUnavailableView {
                    Label("Sin trabajos", systemImage: "calendar.badge.plus")
                } description: {
                    Text("Este día está libre. Agenda un nuevo trabajo cuando te confirmen.")
                } actions: {
                    Button("Agendar nuevo trabajo", action: onAdd)
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            } else {
                ForEach(events, id: \.uuid) { event in
                    Button {
                        onSelect(event)
                    } label: {
                        WorkEventRow(event: event, showAmount: false)
                    }
                    .buttonStyle(.plain)
                }

                Button(action: onAdd) {
                    Label("Agendar nuevo trabajo", systemImage: "plus.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding(.top, 4)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
}
