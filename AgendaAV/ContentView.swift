import SwiftUI

struct ContentView: View {
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
    }
}

#Preview {
    ContentView()
        .modelContainer(PreviewSampleData.container)
}
