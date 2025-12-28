const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

const toLabel = (dayNumber, date) => {
  const parsed = date ? new Date(`${date}T00:00:00Z`) : null;
  const hasDay = dayNumber !== undefined && dayNumber !== null;
  const dateText = parsed && !Number.isNaN(parsed.getTime()) ? dateFormatter.format(parsed) : (date || "");
  if (hasDay && dateText) return `Day ${dayNumber} (${dateText})`;
  if (hasDay) return `Day ${dayNumber}`;
  return dateText;
};

module.exports = (srv) => {
  srv.after("READ", "FestivalDays", (rows) => {
    (Array.isArray(rows) ? rows : [rows]).forEach((row) => {
      if (row) {
        row.label = toLabel(row.dayNumber, row.date);
      }
    });
  });
};
