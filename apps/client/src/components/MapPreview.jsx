import React from 'react';
import { LiveOperationsMap } from './operations/LiveOperationsMap.jsx';

/**
 * Reusable map preview wrapper backed by the full-featured LiveOperationsMap component.
 * Provides Leaflet OpenStreetMap tiles, SVG markers, routes, and layer toggles.
 */
export function MapPreview({
  donations = [],
  shelters = [],
  riders = [],
  assignments = [],
  focusedAssignmentId = null,
  onSelectAssignment,
  height = '520px',
  isMockData = false
}) {
  return (
    <LiveOperationsMap
      donations={donations}
      shelters={shelters}
      riders={riders}
      assignments={assignments}
      focusedAssignmentId={focusedAssignmentId}
      onSelectAssignment={onSelectAssignment}
      height={height}
      isMockData={isMockData}
    />
  );
}

export default MapPreview;
