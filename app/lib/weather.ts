export type WeatherCondition = {
  type?: string;
  description?: { text?: string };
};

export type WeatherPoint = {
  temperature?: { degrees?: number };
  feelsLikeTemperature?: { degrees?: number };
  weatherCondition?: WeatherCondition;
  wind?: { speed?: { value?: number; unit?: string } };
  precipitation?: { probability?: { percent?: number | null } };
  relativeHumidity?: number;
};

export type WeatherHour = {
  interval?: { startTime?: string };
  displayDateTime?: { hours?: number };
  temperature?: { degrees?: number };
  weatherCondition?: WeatherCondition;
  precipitation?: { probability?: { percent?: number | null } };
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
