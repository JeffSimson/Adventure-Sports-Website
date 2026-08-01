const LAT=40.0919;
const LON=-74.3587;
const UA='AdventureSportsOperations/8.3 (weather@adventurenj.com)';
const headers={'User-Agent':UA,'Accept':'application/geo+json, application/json'};

const json=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=180'},body:JSON.stringify(body)});
const fToC=f=>(Number(f)-32)*5/9;
const cToF=c=>Number(c)*9/5+32;
const parseWind=v=>{const m=String(v||'').match(/\d+/);return m?Number(m[0]):0};
const compassDeg=v=>{const d={N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5};return d[String(v||'').toUpperCase()]||0};
const wmo=text=>{text=String(text||'').toLowerCase();if(text.includes('thunder'))return 95;if(text.includes('snow'))return 73;if(text.includes('freezing'))return 66;if(text.includes('heavy rain'))return 65;if(text.includes('showers'))return 80;if(text.includes('rain'))return 63;if(text.includes('drizzle'))return 53;if(text.includes('fog'))return 45;if(text.includes('overcast')||text.includes('cloudy'))return 3;if(text.includes('partly'))return 2;if(text.includes('mostly sunny')||text.includes('mostly clear'))return 1;if(text.includes('sunny')||text.includes('clear'))return 0;return 2};
const isoDate=t=>String(t||'').slice(0,10);

async function get(url,h=headers){const r=await fetch(url,{headers:h});if(!r.ok)throw new Error(`${r.status} from ${url}`);return r.json()}

async function openMeteo(){
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;
 const d=await get(url,{'Accept':'application/json'});d.source='Open-Meteo backup';d.alerts=[];return d;
}

async function nws(){
 const points=await get(`https://api.weather.gov/points/${LAT},${LON}`);
 const p=points.properties;
 const [hourly,daily,stations,alerts,supplement]=await Promise.all([
   get(p.forecastHourly),get(p.forecast),get(p.observationStations),
   get(`https://api.weather.gov/alerts/active?point=${LAT},${LON}`),
   openMeteo().catch(()=>null)
 ]);
 let observation=null;
 const station=stations.features?.[0]?.id;
 if(station)observation=await get(`${station}/observations/latest`).catch(()=>null);
 const hp=hourly.properties.periods||[];
 if(!hp.length)throw new Error('NWS hourly forecast was empty');
 const op=observation?.properties||{};
 const htemp=hp.map(x=>Number(x.temperature)||0);
 const hprob=hp.map(x=>Number(x.probabilityOfPrecipitation?.value)||0);
 const hhum=hp.map(x=>Number(x.relativeHumidity?.value)||0);
 const hdew=hp.map(x=>x.dewpoint?.value==null?0:cToF(x.dewpoint.value));
 const hw=hp.map(x=>parseWind(x.windSpeed));
 const hg=hp.map(x=>parseWind(x.windSpeed));
 const hc=hp.map(x=>wmo(x.shortForecast));
 const times=hp.map(x=>x.startTime);
 const suppH=supplement?.hourly||{};
 const suppIndex=t=>suppH.time?.findIndex(x=>String(x).slice(0,13)===String(t).slice(0,13))??-1;
 const huv=times.map(t=>{const i=suppIndex(t);return i>=0?Number(suppH.uv_index?.[i]||0):0});
 const apparent=times.map((t,i)=>{const si=suppIndex(t);return si>=0?Number(suppH.apparent_temperature?.[si]||htemp[i]):htemp[i]});
 const currentTemp=op.temperature?.value==null?htemp[0]:cToF(op.temperature.value);
 const currentHumidity=op.relativeHumidity?.value==null?hhum[0]:op.relativeHumidity.value;
 const currentWind=op.windSpeed?.value==null?hw[0]:Number(op.windSpeed.value)*0.621371;
 const currentGust=op.windGust?.value==null?hg[0]:Number(op.windGust.value)*0.621371;
 const currentDirection=op.windDirection?.value==null?compassDeg(hp[0].windDirection):op.windDirection.value;
 const currentText=op.textDescription||hp[0].shortForecast;

 const grouped={};
 for(const period of daily.properties.periods||[]){
   const date=isoDate(period.startTime);if(!grouped[date])grouped[date]={date,day:null,night:null};
   if(period.isDaytime)grouped[date].day=period;else grouped[date].night=period;
 }
 const days=Object.values(grouped).slice(0,7);
 const sd=supplement?.daily||{};
 const sdi=date=>sd.time?.indexOf(date)??-1;
 const maxs=days.map(d=>Number(d.day?.temperature??d.night?.temperature??0));
 const mins=days.map(d=>Number(d.night?.temperature??d.day?.temperature??0));
 const rain=days.map(d=>Math.max(Number(d.day?.probabilityOfPrecipitation?.value||0),Number(d.night?.probabilityOfPrecipitation?.value||0)));
 const codes=days.map(d=>wmo(d.day?.shortForecast||d.night?.shortForecast));
 const winds=days.map(d=>Math.max(parseWind(d.day?.windSpeed),parseWind(d.night?.windSpeed)));
 const sunrise=days.map(d=>{const i=sdi(d.date);return i>=0?sd.sunrise?.[i]:null});
 const sunset=days.map(d=>{const i=sdi(d.date);return i>=0?sd.sunset?.[i]:null});
 const uvmax=days.map(d=>{const i=sdi(d.date);return i>=0?Number(sd.uv_index_max?.[i]||0):0});

 return {
  source:'National Weather Service',
  source_detail:`NWS ${p.gridId||''} forecast with local station observations`,
  alerts:(alerts.features||[]).map(a=>({id:a.id,event:a.properties.event,severity:a.properties.severity,headline:a.properties.headline,description:a.properties.description,instruction:a.properties.instruction,expires:a.properties.expires})),
  current:{time:op.timestamp||hp[0].startTime,temperature_2m:currentTemp,relative_humidity_2m:currentHumidity,apparent_temperature:apparent[0],precipitation:0,rain:0,weather_code:wmo(currentText),cloud_cover:0,wind_speed_10m:currentWind,wind_direction_10m:currentDirection,wind_gusts_10m:currentGust},
  hourly:{time:times,temperature_2m:htemp,relative_humidity_2m:hhum,dew_point_2m:hdew,apparent_temperature:apparent,precipitation_probability:hprob,precipitation:times.map(()=>0),rain:times.map(()=>0),weather_code:hc,wind_speed_10m:hw,wind_direction_10m:hp.map(x=>compassDeg(x.windDirection)),wind_gusts_10m:hg,uv_index:huv},
  daily:{time:days.map(d=>d.date),weather_code:codes,temperature_2m_max:maxs,temperature_2m_min:mins,apparent_temperature_max:maxs,precipitation_sum:days.map(()=>0),precipitation_probability_max:rain,sunrise,sunset,uv_index_max:uvmax,wind_speed_10m_max:winds,wind_gusts_10m_max:winds}
 };
}

exports.handler=async()=>{
 try{return json(200,await nws())}
 catch(primaryError){
  try{const fallback=await openMeteo();fallback.primary_error=primaryError.message;return json(200,fallback)}
  catch(fallbackError){return json(503,{error:'Weather services are temporarily unavailable.',primary:primaryError.message,fallback:fallbackError.message})}
 }
};
