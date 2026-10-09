import SwiftData
import SwiftUI

struct BudgetView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \FixedExpense.dueDay) private var expenses: [FixedExpense]
    @Query(sort: \WorkEvent.startDate) private var events: [WorkEvent]
    @State private var month = Calendar.current.startOfMonth(for: .now)
    @State private var editingExpense: FixedExpense?
    @State private var showingNewExpense = false

    private var period: ReportPeriod {
        var value = ReportPeriod()
        value.kind = .monthly
        value.monthAnchor = month
        return value
    }

    private var jobSummary: ReportSummary {
        ReportCalculator.summarize(events: events, period: period)
    }

    private var pending: [FixedExpense] {
        expenses.filter { !$0.isPaid(in: month) }
    }

    private var paid: [FixedExpense] {
        expenses.filter { $0.isPaid(in: month) }
    }

    private var expenseTotal: Decimal {
        expenses.reduce(0) { $0 + $1.amount }
    }

    private var expensePaid: Decimal {
        paid.reduce(0) { $0 + $1.amount }
    }

    private var expensePending: Decimal {
        pending.reduce(0) { $0 + $1.amount }
    }

    private var plannedBalance: Decimal {
        jobSummary.totalAmount - expenseTotal
    }

    private var cashBalance: Decimal {
        jobSummary.payment.paidAmount - expensePaid
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    monthCard
                    metricsGrid
                    pendingCard
                    if !paid.isEmpty {
                        paidCard
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Presupuesto")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingNewExpense = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Agregar gasto fijo")
                }
            }
            .sheet(isPresented: $showingNewExpense) {
                ExpenseEditorSheet()
            }
            .sheet(item: $editingExpense) { expense in
                ExpenseEditorSheet(expense: expense)
            }
        }
    }

    private var monthCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Button {
                    month = Calendar.current.date(byAdding: .month, value: -1, to: month) ?? month
                } label: {
                    Image(systemName: "chevron.left")
                }
                Spacer()
                Text(month.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "es_DO"))))
                    .font(.headline)
                    .textCase(.lowercase)
                Spacer()
                Button {
                    month = Calendar.current.date(byAdding: .month, value: 1, to: month) ?? month
                } label: {
                    Image(systemName: "chevron.right")
                }
            }
            Text("Agrega tus gastos fijos una vez (alquiler, internet, teléfono). Salen todos los meses. Aquí marcas lo que ya pagaste y lo que falta.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private var metricsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            metricTile("Ingresos (trabajos)", jobSummary.totalAmount)
            metricTile("Gastos fijos", expenseTotal)
            metricTile("Pagado", expensePaid)
            metricTile("Falta por pagar", expensePending)
            metricTile("Balance", plannedBalance, color: plannedBalance >= 0 ? .green : .red)
            metricTile("Queda (cobrado − pagado)", cashBalance)
        }
    }

    private func metricTile(_ title: String, _ value: Decimal, color: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(CurrencyFormat.string(from: value))
                .font(.headline)
                .foregroundStyle(color ?? .primary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var pendingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Falta por pagar")
                .font(.headline)
            Text("Gastos de este mes que todavía no marcas como pagados.")
                .font(.caption)
                .foregroundStyle(.secondary)
            if pending.isEmpty {
                Text(expenses.isEmpty
                     ? "Todavía no hay gastos fijos. Toca + para agregar uno."
                     : "Este mes no te falta ningún gasto fijo.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(pending, id: \.uuid) { expense in
                    expenseBlock(expense, paid: false)
                }
            }
            Button {
                showingNewExpense = true
            } label: {
                Label("Agregar gasto fijo", systemImage: "plus.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private var paidCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ya pagado")
                .font(.headline)
            Text("Estos gastos ya los marcaste como pagados este mes.")
                .font(.caption)
                .foregroundStyle(.secondary)
            ForEach(paid, id: \.uuid) { expense in
                expenseBlock(expense, paid: true)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private func expenseBlock(_ expense: FixedExpense, paid: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                editingExpense = expense
            } label: {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(expense.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                        Text("Día \(expense.dueDay)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !expense.notes.isEmpty {
                            Text(expense.notes)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Text(CurrencyFormat.string(from: expense.amount))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                }
            }
            .buttonStyle(.plain)

            Text(paid ? "Pagado" : "Pendiente")
                .font(.caption.weight(.semibold))
                .foregroundStyle(paid ? .green : .orange)

            Button {
                expense.setPaid(!paid, in: month)
                try? modelContext.save()
            } label: {
                Text(paid ? "Marcar pendiente" : "Marcar pagado")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(paid ? .orange : .green)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}