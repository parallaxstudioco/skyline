# Social Skyline — Full System Requirements

## 1. Project Overview

Social Skyline is an interactive web platform that visualizes Instagram creator accounts as dynamic 3D buildings placed on a real-world map. Each building represents a connected Instagram account and updates based on live engagement metrics.

The platform transforms social media activity into a visual cityscape where building height, brightness, and window lighting represent different engagement signals.

Creators can connect their Instagram account, and their building appears on the global map at their approximate location. As their account metrics change, their building updates in real time.

The system must use live data fetched from Instagram while respecting API rate limits using Redis caching and rate limiting.

---

# 2. Core Features

## 2.1 Instagram Account Linking

Users must be able to connect their Instagram account using OAuth authentication via the Instagram Graph API.

Connection flow:

1. User clicks **Connect Instagram**
2. User authenticates via Meta OAuth
3. Instagram returns authorization code
4. Backend exchanges code for access token
5. Backend retrieves Instagram Business Account ID

Only minimal account data should be stored:

* instagram_user_id
* username
* access_token
* token_expiry

No posts, comments, or engagement history should be permanently stored.

---

# 3. Creator Location Detection

When a user connects their account, the backend should detect their approximate location using IP-based geolocation.

Use a geolocation API such as:

* ipapi
* ipinfo

Retrieve:

* latitude
* longitude
* city
* country

Coordinates must be rounded to avoid exposing precise location.

Stored location data:

* instagram_user_id
* latitude
* longitude
* city
* country

This location is used to place the creator’s building on the world map.

---

# 4. Map Visualization

The platform must render a world map using the Google Maps JavaScript API.

Creator buildings should appear on the map at the stored geographic coordinates.

Map features must include:

* zooming
* panning
* global exploration

When zooming into regions with multiple creators, buildings should form clusters representing mini skylines.

---

# 5. 3D Building Representation

Each connected Instagram account is represented as a 3D skyscraper rendered with Three.js and React Three Fiber.

Building attributes must map Instagram metrics to visual properties.

Metric Mapping:

Followers → building height
Post count → number of floors
Average likes → building width
Views → building brightness

Buildings should animate smoothly when metrics update.

---

# 6. Window Representation (Posts)

Each floor contains windows that represent individual posts.

Window behavior:

Normal posts display a soft white window light.

If a post receives high comment activity, the window brightness increases slightly.

If comments on a post receive likes above a threshold, the window changes to a glowing golden yellow color.

Golden window color:

#ffc400

Golden windows visually highlight posts where meaningful conversations are happening.

Each window must be rendered using emissive lighting so it appears illuminated in the city skyline.

---

# 7. Building Brightness Based on Views

The total views across recent posts determine the brightness of the building.

Buildings with more views should shine brighter.

Brightness calculation must use logarithmic scaling to normalize large differences in view counts.

Example formula:

glow_intensity = log10(total_views) * 0.3

Buildings should visually glow using emissive materials.

If view counts increase significantly, trigger a short glow pulse animation.

---

# 8. Real-Time Data Fetching

Instagram account metrics must be fetched dynamically using the Instagram Graph API.

Required metrics:

* followers_count
* media_count
* post engagement metrics
* view counts

Metrics must be retrieved via backend API endpoints and returned to the frontend.

The system should avoid permanently storing engagement data.

---

# 9. Redis Caching and Rate Limiting

Redis must be used to manage API rate limits and caching.

The system must implement:

* caching of Instagram responses
* per-user rate limiting
* global application rate limiting

Cache rules:

Account metrics cache duration: 5 minutes
Post engagement cache duration: 2 minutes

Rate limits:

Maximum 60 API requests per hour per Instagram account
Maximum 200 API requests per hour globally

Redis key structure:

rate_limit:global
rate_limit:user:{instagram_user_id}

Cached responses must be served when available to reduce API calls.

---

# 10. Worker Queue for Data Refresh

A background worker system should periodically refresh Instagram metrics.

Use Redis and BullMQ to schedule jobs.

Worker process:

1. Fetch metrics from Instagram API
2. Update Redis cache
3. Broadcast updated metrics to clients

Refresh frequency:

Account metrics: every 5–10 minutes
Engagement metrics: every 2–5 minutes

---

# 11. Webhook Integration

The system must subscribe to Instagram webhooks to receive certain real-time events.

Webhook endpoint should receive notifications for:

* comments
* mentions
* messages

Webhook events must trigger updates in the frontend visualization.

---

# 12. Real-Time Updates

The backend must use WebSockets or Socket.io to push updates to the frontend.

When updated metrics arrive:

Follower changes → building height updates
Post count changes → new floors appear
Engagement spikes → glow animations
Comment-like activity → golden window lighting

---

# 13. Frontend Interface

The frontend must present a full-screen interactive map with a 3D overlay.

Users should be able to:

* explore the global map
* zoom into cities
* see creator buildings
* click buildings to view creator information

Core UI components:

MapContainer
BuildingRenderer
CreatorTooltip
AccountDetailsPanel
NavigationControls

---

# 14. Technology Stack

Frontend:

Next.js
React
TypeScript
React Three Fiber
Three.js
TailwindCSS

Backend:

Node.js
Express or Next.js API routes

Infrastructure:

Redis (caching and rate limiting)
BullMQ (job queue)
WebSockets / Socket.io (real-time updates)

External APIs:

Instagram Graph API
Google Maps JavaScript API
IP geolocation API

---

# 15. Privacy and Security

The system must protect user privacy.

The platform must not store:

* posts
* comments
* engagement history

Location data must remain approximate.

Access tokens must be stored securely on the backend and never exposed to the frontend.

---

# 16. Performance Requirements

The system must support rendering hundreds of creator buildings simultaneously.

Optimizations must include:

* level-of-detail rendering for buildings
* dynamic loading of map regions
* Redis caching for API responses
* optimized Three.js rendering

---

# 17. MVP Scope

The MVP must include:

Instagram account linking
IP-based creator location detection
3D building visualization on Google Maps
Live metric fetching
Redis caching and rate limiting
Window lighting system
Building brightness based on views
Basic real-time updates

Advanced analytics and creator network visualization may be added later.

---

# 18. Future Enhancements

Potential future expansions include:

* creator community clustering
* influence network visualization
* historical creator growth timelines
* AI-based growth predictions
* district-based creator ecosystems

The architecture should remain modular to support future expansion.
