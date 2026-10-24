const hasText = (value) => typeof value === "string" && value.trim().length > 0;

// Council service and active roster membership are independent: former fighters
// can still appear in council history. Approximate dates do not imply current service.
export function isCouncilMember(member) {
  return (
    member.councilCurrent === true ||
    hasText(member.councilTermStart) ||
    hasText(member.councilTermEnd) ||
    hasText(member.councilHistoricalDate) ||
    (Array.isArray(member.councilHistory) && member.councilHistory.length > 0)
  );
}
export function councilMembers(members = []) {
  return Array.isArray(members) ? members.filter(isCouncilMember) : [];
}
export function currentCouncilMembers(members = []) {
  return councilMembers(members).filter(
    (member) => member.councilCurrent === true,
  );
}
