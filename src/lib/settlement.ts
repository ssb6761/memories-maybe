import { Expense, SettlementResult, SettlementRow, SettlementTransfer, Traveler } from "./types";

// CSV의 "결제한 사람/결제한 사람 수/나눠 낼 사람/나눠 낼 사람 수" 데이터를 기준으로
// 각 동행자의 실제 결제액과 부담해야 할 금액을 계산하고, 최종적으로 누가 누구에게
// 얼마를 보내야 하는지(정산)까지 산출한다. "나만보기 비용"은 공동 정산에서 제외한다.
export function calculateSettlement(
  travelers: Traveler[],
  expenses: Expense[]
): SettlementResult {
  const sharedExpenses = expenses.filter((e) => !e.privateOnly);
  const totalKRW = sharedExpenses.reduce((sum, e) => sum + (e.amountKRW || 0), 0);

  const rows: SettlementRow[] = travelers.map((t) => {
    let paidKRW = 0;
    let owedKRW = 0;

    for (const e of sharedExpenses) {
      const amount = e.amountKRW || 0;
      if (e.paidBy.includes(t.name) && e.paidByCount > 0) {
        paidKRW += amount / e.paidByCount;
      }
      if (e.splitWith.includes(t.name) && e.splitCount > 0) {
        owedKRW += amount / e.splitCount;
      }
    }

    return {
      travelerId: t.id,
      name: t.name,
      paidKRW: round0(paidKRW),
      owedKRW: round0(owedKRW),
      balanceKRW: round0(paidKRW - owedKRW),
    };
  });

  const transfers = settleBalances(rows);

  return { totalKRW: round0(totalKRW), rows, transfers };
}

// 잔액(balance)이 + 인 사람은 돌려받아야 하고 - 인 사람은 보내야 한다.
// 채무자(-) -> 채권자(+) 로 그리디하게 매칭해 최소 송금 횟수로 정산 내역을 만든다.
function settleBalances(rows: SettlementRow[]): SettlementTransfer[] {
  const creditors = rows
    .filter((r) => r.balanceKRW > 0)
    .map((r) => ({ name: r.name, amount: r.balanceKRW }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = rows
    .filter((r) => r.balanceKRW < 0)
    .map((r) => ({ name: r.name, amount: -r.balanceKRW }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount >= 1) {
      transfers.push({
        fromName: debtor.name,
        toName: creditor.name,
        amountKRW: round0(amount),
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 1) i++;
    if (creditor.amount < 1) j++;
  }

  return transfers;
}

function round0(n: number): number {
  return Math.round(n);
}
