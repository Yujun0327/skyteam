export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'
export type Weather = 'clear' | 'fog' | 'rain' | 'storm' | 'snow' | 'haze'

export interface AirportDef {
  code: string
  city: string
  name: string
  timeOfDay: TimeOfDay
  weather: Weather
  /** rough scenery flavour for the windshield */
  terrain: 'water' | 'city' | 'mountain' | 'plain' | 'ice'
  briefing: string
}

export const AIRPORTS: Record<string, AirportDef> = {
  YUL: { code: 'YUL', city: 'Montreal', name: 'Montreal-Trudeau', timeOfDay: 'dawn', weather: 'clear', terrain: 'water', briefing: 'Sunrise over the St. Lawrence. Perfect conditions. A routine approach for a new crew.' },
  LHR: { code: 'LHR', city: 'London', name: 'Heathrow', timeOfDay: 'night', weather: 'fog', terrain: 'city', briefing: 'Fog over the Thames and traffic stacked along the approach. Stay calm and land the aircraft.' },
  HND: { code: 'HND', city: 'Tokyo', name: 'Haneda', timeOfDay: 'dusk', weather: 'clear', terrain: 'water', briefing: 'A wide turn over Tokyo Bay to line up with the runway. Hold the axis through the corridor.' },
  OSL: { code: 'OSL', city: 'Oslo', name: 'Gardermoen', timeOfDay: 'night', weather: 'snow', terrain: 'plain', briefing: 'Snow on the approach and fuel running low. Watch the kerosene.' },
  ATL: { code: 'ATL', city: 'Atlanta', name: 'Hartsfield-Jackson', timeOfDay: 'night', weather: 'clear', terrain: 'city', briefing: 'The busiest airspace in the world. Traffic everywhere.' },
  PRG: { code: 'PRG', city: 'Prague', name: 'Vaclav Havel', timeOfDay: 'dusk', weather: 'clear', terrain: 'city', briefing: 'Clear sky over Bohemia. Manage the fuel and the corridor.' },
  TGU: { code: 'TGU', city: 'Tegucigalpa', name: 'Toncontin', timeOfDay: 'day', weather: 'haze', terrain: 'mountain', briefing: 'A bowl of mountains, a rapid descent and a very tight final turn. One of the hardest approaches on Earth.' },
  GIG: { code: 'GIG', city: 'Rio de Janeiro', name: 'Galeao', timeOfDay: 'dusk', weather: 'rain', terrain: 'water', briefing: 'Tower not responding. A strong tail wind over Copacabana. Control your speed with the axis.' },
  KEF: { code: 'KEF', city: 'Reykjavik', name: 'Keflavik', timeOfDay: 'night', weather: 'snow', terrain: 'ice', briefing: 'Fresh snow, an icy runway. Deploy the special brakes.' },
  KUL: { code: 'KUL', city: 'Kuala Lumpur', name: 'Kuala Lumpur', timeOfDay: 'night', weather: 'storm', terrain: 'plain', briefing: 'Electrical storms over Malaysia. Fly between the cells.' },
  PBH: { code: 'PBH', city: 'Paro', name: 'Paro', timeOfDay: 'day', weather: 'haze', terrain: 'mountain', briefing: 'A narrow Himalayan valley above 7,000 feet. Only a handful of pilots are certified here.' },
  BLQ: { code: 'BLQ', city: 'Bologna', name: 'Guglielmo Marconi', timeOfDay: 'dusk', weather: 'clear', terrain: 'plain', briefing: 'Evening over the Po valley.' },
  BUD: { code: 'BUD', city: 'Budapest', name: 'Liszt Ferenc', timeOfDay: 'night', weather: 'clear', terrain: 'city', briefing: 'Night approach over the Danube with a strong wind.' },
  NZIR: { code: 'NZIR', city: 'Antarctica', name: 'Ice Runway', timeOfDay: 'day', weather: 'snow', terrain: 'ice', briefing: 'A runway carved into sea ice. Head-on wind.' },
  TER: { code: 'TER', city: 'Azores', name: 'Lajes', timeOfDay: 'day', weather: 'clear', terrain: 'water', briefing: 'Both engines are out. You are gliding. The axis is all you have.' },
  LGA: { code: 'LGA', city: 'New York', name: 'LaGuardia', timeOfDay: 'night', weather: 'clear', terrain: 'city', briefing: 'Short runway, dense traffic, the skyline on the left.' },
  DUS: { code: 'DUS', city: 'Dusseldorf', name: 'Dusseldorf', timeOfDay: 'night', weather: 'rain', terrain: 'city', briefing: 'Rain on the Rhine and a kerosene leak.' },
  CDG: { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', timeOfDay: 'dusk', weather: 'clear', terrain: 'city', briefing: 'Wind over the Ile-de-France and an intern in the jump seat.' },
  MAD: { code: 'MAD', city: 'Madrid', name: 'Barajas', timeOfDay: 'day', weather: 'clear', terrain: 'plain', briefing: 'High plateau, thin air, a late start.' },
}

export function airport(code: string): AirportDef {
  return AIRPORTS[code] ?? { code, city: code, name: code, timeOfDay: 'night', weather: 'clear', terrain: 'plain', briefing: '' }
}
