export type WeatherCondition = {
  type?: string;
  description?: { text?: string };
};

export type Precipitation = {
  probability?: { percent?: number | null };
  amount?: number | null;
};

export type WeatherPoint = {
  temperature?: { degrees?: number };
  feelsLikeTemperature?: { degrees?: number };
  weatherCondition?: WeatherCondition;
  wind?: { speed?: { value?: number; unit?: string } };
  precipitation?: Precipitation;
  relativeHumidity?: number;
};

export type WeatherHour = {
  interval?: { startTime?: string };
  displayDateTime?: { hours?: number };
  temperature?: { degrees?: number };
  weatherCondition?: WeatherCondition;
  precipitation?: Precipitation;
};

export type WeatherResponse = {
  configured: boolean;
  source?: string;
  current?: WeatherPoint;
  hourly?: WeatherHour[];
  timeZone?: { id?: string };
  fetchedAt?: string;
  error?: string;
};
