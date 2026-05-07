# Go-Live Checklist

Minimum go-live gates:

- npm run build passes
- database backup exists
- restore tested on staging
- migrations tested on staging
- service role key is not exposed in frontend
- RLS reviewed
- posting validation active
- import staging active
- rollback plan exists
