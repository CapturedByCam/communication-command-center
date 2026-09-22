# Use Google Sheets as the V1 operational store

## Question

What should be the V1 source of persistent operational state?

## Type

Grilling + domain modeling

## Status

Closed

## Resolution

Use one private Google Sheet with versioned tabs as the V1 operational store. It is observable, easy to inspect, compatible with Workspace Studio and Apps Script, and appropriate for a single-user pilot. Store only operational metadata. Trigger a migration decision only when measured limits appear: concurrency conflicts, query complexity, row volume, latency, stronger access controls, or multi-user requirements.
