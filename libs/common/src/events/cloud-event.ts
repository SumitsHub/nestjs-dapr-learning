export interface CloudEvent<T> {
  id: string;
  source: string;
  specversion: string;
  type: string;
  time: string;

  topic: string;
  pubsubname: string;

  traceid?: string;
  traceparent?: string;
  tracestate?: string;

  datacontenttype: string;

  data: T;
}
