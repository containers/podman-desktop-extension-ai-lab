import moment from 'moment';
import humanizeDuration from 'humanize-duration';

export function humanizeAge(created: number): string {
  // get start time in ms (using unix timestamp for the created)
  const age = moment().diff(moment.unix(created));
  // make it human friendly
  return humanizeDuration(age, { round: true, largest: 1 });
}
