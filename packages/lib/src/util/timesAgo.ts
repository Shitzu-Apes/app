export function readableDuration(milliseconds: number, depth: number = 1) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  const remainingMonths = months % 12;
  const remainingDays = days % 30;
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (years > 0) {
    if (depth >= 2) return `${years}y ${remainingMonths}mo`;
    return `${years}y`;
  }
  if (months > 0) {
    if (depth >= 2) return `${months}mo ${remainingDays}d`;
    return `${months}mo`;
  }
  if (days > 0) {
    if (depth >= 2) return `${days}d ${remainingHours}h`;
    return `${days}d`;
  }
  if (hours > 0) {
    if (depth >= 2) return `${hours}h ${remainingMinutes}m`;
    return `${hours}h`;
  }
  if (minutes > 0) {
    if (depth >= 2) return `${minutes}m ${remainingSeconds}s`;
    return `${minutes}m`;
  }
  if (seconds > 0) return `${seconds}s`;
  return "0s";
}

export function timesAgo(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return readableDuration(diff);
}
