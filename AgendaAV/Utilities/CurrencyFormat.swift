import Foundation

enum CurrencyFormat {
    private static let savedAmountsKey = "agendaAV.savedAmounts"
    private static let lastAmountKey = "agendaAV.lastDailyAmount"

    /// Código ISO de la moneda (pesos dominicanos).
    static var code: String { "DOP" }

    static var savedAmounts: [Decimal] {
        get {
            let stored = UserDefaults.standard.array(forKey: savedAmountsKey) as? [Double] ?? []
            var values = stored.map { Decimal($0) }.filter { $0 > 0 }
            let legacy = Decimal(UserDefaults.standard.double(forKey: lastAmountKey))
            if legacy > 0 { values.insert(legacy, at: 0) }
            return uniqued(values)
        }
        set {
            UserDefaults.standard.set(
                uniqued(newValue).map { ($0 as NSDecimalNumber).doubleValue },
                forKey: savedAmountsKey
            )
        }
    }

    static func remember(_ amount: Decimal) {
        guard amount > 0 else { return }
        savedAmounts = [amount] + savedAmounts
    }

    static func uniqued(_ amounts: [Decimal]) -> [Decimal] {
        var seen = Set<String>()
        var result: [Decimal] = []
        for amount in amounts where amount > 0 {
            let key = (amount as NSDecimalNumber).stringValue
            if seen.insert(key).inserted {
                result.append(amount)
            }
        }
        return result.sorted { $0 > $1 }
    }

    static func string(from amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.currencySymbol = "RD$"
        formatter.locale = Locale(identifier: "es_DO")
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: amount as NSDecimalNumber) ?? "RD$\(amount)"
    }

    static func plainString(from amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "es_DO")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}
