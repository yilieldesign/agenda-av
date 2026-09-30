import SwiftData
import SwiftUI

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var events: [WorkEvent]

    var body: some View {
        TabView {
            CalendarView()
                .tabItem {
                    Label("Agenda", systemImage: "calendar")
                }

            ReportsView()
                .tabItem {
                    Label("Reportes", systemImage: "chart.bar.doc.horizontal")
                }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Text(AVStyle.appCredit)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.top, 6)
                .padding(.bottom, 4)
                .background(Color(.systemBackground))
        }
        .task {
            await EventReminderScheduler.sync(events: events)
            try? modelContext.save()
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(PreviewSampleData.container)
}
