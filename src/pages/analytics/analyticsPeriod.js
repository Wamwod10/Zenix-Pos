import {recordDateKey} from '../../utils/reporting.js';

// Use the report's range snapshot rather than rebuilding today's range per row.
export const filterAnalyticsPeriod=(records,range,timezone)=>records.filter(record=>{
  const key=recordDateKey(record,timezone);
  if(!key)return !range.from&&!range.to;
  return (!range.from||key>=range.from)&&(!range.to||key<=range.to);
});
