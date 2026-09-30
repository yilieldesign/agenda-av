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
