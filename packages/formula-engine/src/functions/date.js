/**
 * Date and Time Functions
 * monday.com formula date/time manipulation functions.
 */

/**
 * Helper: Parse a date from various formats
 */
function parseDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Helper: Check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Helper: Format date as ISO string (YYYY-MM-DD)
 */
function formatDateISO(date) {
  const d = parseDate(date);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * TODAY - Gets the current date.
 * Example: TODAY() => "2024-01-15"
 */
export function TODAY() {
  const now = new Date();
  return formatDateISO(now);
}

/**
 * NOW - Gets the current date and time.
 * Example: NOW() => Date object
 */
export function NOW() {
  return new Date();
}

/**
 * ADD_DAYS - Adds days to the given date. Returns the new date.
 * Example: ADD_DAYS("2019-01-20", 5) => "2019-01-25"
 */
export function ADD_DAYS(date, days) {
  const d = parseDate(date);
  if (!d) return '';

  const numDays = Number(days) || 0;
  d.setDate(d.getDate() + numDays);
  return formatDateISO(d);
}

/**
 * SUBTRACT_DAYS - Subtract days from the given date. Returns the new date.
 * Example: SUBTRACT_DAYS("2019-01-20", 5) => "2019-01-15"
 */
export function SUBTRACT_DAYS(date, days) {
  return ADD_DAYS(date, -(Number(days) || 0));
}

/**
 * DATE - Returns a date for the given year, month, day.
 * Example: DATE(2018, 5, 30) => "2018-05-30"
 */
export function DATE(year, month, day) {
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || 1;
  const d = Number(day) || 1;

  const date = new Date(y, m - 1, d); // Month is 0-indexed
  return formatDateISO(date);
}

/**
 * DAY - Returns the day of the month of a given date.
 * Example: DAY("2024-01-31") => 31
 */
export function DAY(date) {
  const d = parseDate(date);
  if (!d) return 0;
  return d.getDate();
}

/**
 * MONTH - Returns the month of a given date (1-12).
 * Example: MONTH("2024-07-15") => 7
 */
export function MONTH(date) {
  const d = parseDate(date);
  if (!d) return 0;
  return d.getMonth() + 1;
}

/**
 * YEAR - Returns the year of a given date.
 * Example: YEAR("2024-01-15") => 2024
 */
export function YEAR(date) {
  const d = parseDate(date);
  if (!d) return 0;
  return d.getFullYear();
}

/**
 * DAYS - Returns the number of days between two dates.
 * Example: DAYS({end date}, {start date}) => difference in days
 */
export function DAYS(endDate, startDate) {
  const end = parseDate(endDate);
  const start = parseDate(startDate);

  if (!end || !start) return 0;

  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * HOUR - Returns the hour as a number from 0 to 23.
 * Example: HOUR(NOW()) => 14
 */
export function HOUR(datetime) {
  const d = parseDate(datetime);
  if (!d) return 0;
  return d.getHours();
}

/**
 * MINUTE - Returns the minute as a number from 0 to 59.
 * Example: MINUTE(NOW()) => 30
 */
export function MINUTE(datetime) {
  const d = parseDate(datetime);
  if (!d) return 0;
  return d.getMinutes();
}

/**
 * SECOND - Returns the second as a number from 0 to 59.
 * Example: SECOND(NOW()) => 45
 */
export function SECOND(datetime) {
  const d = parseDate(datetime);
  if (!d) return 0;
  return d.getSeconds();
}

/**
 * HOURS_DIFF - Returns the difference between two hours.
 * Example: HOURS_DIFF("23:00", "20:00") => "03:00"
 */
export function HOURS_DIFF(time1, time2) {
  // Parse time strings in HH:MM format
  const parseTime = (t) => {
    if (!t) return null;
    const str = String(t);
    const match = str.match(/(\d+):(\d+)/);
    if (!match) return null;
    return { hours: parseInt(match[1]), minutes: parseInt(match[2]) };
  };

  const t1 = parseTime(time1);
  const t2 = parseTime(time2);

  if (!t1 || !t2) return '00:00';

  const minutes1 = t1.hours * 60 + t1.minutes;
  const minutes2 = t2.hours * 60 + t2.minutes;
  const diff = Math.abs(minutes1 - minutes2);

  const hours = Math.floor(diff / 60);
  const mins = diff % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * WEEKNUM - Returns the yearly week number of a given date.
 * Example: WEEKNUM("2024-10-15") => 42
 */
export function WEEKNUM(date) {
  const d = parseDate(date);
  if (!d) return 0;

  // Get first day of the year
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - yearStart.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  return Math.ceil((diff / oneWeek) + 1);
}

/**
 * ISOWEEKNUM - Returns the ISO week number of a given date.
 * Example: ISOWEEKNUM("2024-10-15") => 42
 */
export function ISOWEEKNUM(date) {
  const d = parseDate(date);
  if (!d) return 0;

  // Copy date so don't modify original
  const target = new Date(d.valueOf());

  // ISO week starts on Monday - set to nearest Thursday
  const dayNum = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);

  // Get first Thursday of year
  const firstThursday = new Date(target.getFullYear(), 0, 4);

  // Calculate week number
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/**
 * WORKDAYS - Returns the number of working days between two dates.
 * Example: WORKDAYS({end date}, {start date}) => working days
 */
export function WORKDAYS(endDate, startDate) {
  const end = parseDate(endDate);
  const start = parseDate(startDate);

  if (!end || !start) return 0;

  let count = 0;
  const current = new Date(start);
  const direction = end >= start ? 1 : -1;

  while (direction === 1 ? current <= end : current >= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + direction);
  }

  return count;
}

/**
 * WORKDAY - Adds working days to the given date. Returns the new date.
 * Example: WORKDAY({Date column}, 20) => new date after 20 working days
 */
export function WORKDAY(date, workdays) {
  const d = parseDate(date);
  if (!d) return '';

  let numDays = Number(workdays) || 0;
  const direction = numDays >= 0 ? 1 : -1;
  numDays = Math.abs(numDays);

  const result = new Date(d);
  let count = 0;

  while (count < numDays) {
    result.setDate(result.getDate() + direction);
    if (!isWeekend(result)) {
      count++;
    }
  }

  return formatDateISO(result);
}

/**
 * SUBTRACT_MINUTES - Subtracts minutes from a given date/time.
 * Example: SUBTRACT_MINUTES({Date}, 30) => time 30 minutes earlier
 */
export function SUBTRACT_MINUTES(datetime, minutes) {
  const d = parseDate(datetime);
  if (!d) return '';

  const mins = Number(minutes) || 0;
  d.setMinutes(d.getMinutes() - mins);
  return d;
}

/**
 * DATEVALUE - Converts a text string to a date.
 * Example: DATEVALUE("2025-11-12") => Date for Nov 12, 2025
 */
export function DATEVALUE(dateString) {
  const d = parseDate(dateString);
  if (!d) return '';
  return formatDateISO(d);
}

/**
 * FORMAT_DATE - Returns a formatted date string.
 * Example: FORMAT_DATE(TODAY(), "YYYY-MM-DD") => "2024-01-15"
 * Example: FORMAT_DATE(TODAY(), "dddd, MMMM Do YYYY") => "Monday, January 15th 2024"
 */
export function FORMAT_DATE(date, format = 'MMM DD, YYYY') {
  const d = parseDate(date);
  if (!d) return '';

  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();
  const dayOfWeek = d.getDay();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ];

  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Ordinal suffix
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Replace patterns (order matters - longer patterns first)
  let result = format
    // Year
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    // Month
    .replace('MMMM', monthNames[month])
    .replace('MMM', monthNamesShort[month])
    .replace('MM', String(month + 1).padStart(2, '0'))
    .replace('M', String(month + 1))
    // Day of week
    .replace('dddd', dayNames[dayOfWeek])
    .replace('ddd', dayNamesShort[dayOfWeek])
    // Day with ordinal
    .replace('Do', getOrdinal(day))
    // Day
    .replace('DD', String(day).padStart(2, '0'))
    .replace('D', String(day))
    // Hours (24h)
    .replace('HH', String(hours).padStart(2, '0'))
    .replace('H', String(hours))
    // Hours (12h)
    .replace('hh', String(hours % 12 || 12).padStart(2, '0'))
    .replace('h', String(hours % 12 || 12))
    // Minutes
    .replace('mm', String(minutes).padStart(2, '0'))
    .replace('m', String(minutes))
    // Seconds
    .replace('ss', String(seconds).padStart(2, '0'))
    .replace('s', String(seconds))
    // AM/PM
    .replace('A', hours >= 12 ? 'PM' : 'AM')
    .replace('a', hours >= 12 ? 'pm' : 'am');

  return result;
}

export default {
  TODAY,
  NOW,
  ADD_DAYS,
  SUBTRACT_DAYS,
  DATE,
  DAY,
  MONTH,
  YEAR,
  DAYS,
  HOUR,
  MINUTE,
  SECOND,
  HOURS_DIFF,
  WEEKNUM,
  ISOWEEKNUM,
  WORKDAYS,
  WORKDAY,
  SUBTRACT_MINUTES,
  DATEVALUE,
  FORMAT_DATE,
};
