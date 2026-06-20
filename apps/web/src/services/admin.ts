import { gql } from './graphql';

export interface DashboardSummary {
  totalIncidents: number;
  openIncidents: number;
  inProgressIncidents: number;
  activeZones: number;
  congestionZonesCount: number;
}

export interface IncidentType {
  id: string;
  type: string;
  severity: string;
  status: string;
  zone: string | null;
  description: string | null;
  photoUrl: string | null;
  addressLabel: string | null;
  upvoteCount: number;
  department: string | null;
  reporterName: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
  location: { lat: number; lon: number } | null;
}

export interface HotspotType {
  zone: string;
  incidentCount: number;
  lat: number;
  lon: number;
}

export interface EquityMetricType {
  zone: string;
  totalIncidents: number;
  avgResolutionTimeMinutes: number;
}

export interface UserType {
  id: string;
  email: string;
  fullName: string;
  role: string;
  zone: string | null;
}

export interface MutationResponse {
  success: boolean;
  message: string | null;
  id: string | null;
}

// Queries

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return gql<{ dashboardSummary: DashboardSummary }>(`
    query DashboardSummary {
      dashboardSummary {
        totalIncidents
        openIncidents
        inProgressIncidents
        activeZones
        congestionZonesCount
      }
    }
  `).then(d => d.dashboardSummary);
}

export async function fetchIncidentList(
  status?: string,
  zone?: string,
  limit = 50,
  offset = 0,
): Promise<IncidentType[]> {
  return gql<{ incidents: IncidentType[] }>(`
    query Incidents($status: String, $zone: String, $limit: Int, $offset: Int) {
      incidents(status: $status, zone: $zone, limit: $limit, offset: $offset) {
        id
        type
        severity
        status
        zone
        description
        photoUrl
        addressLabel
        upvoteCount
        department
        reporterName
        assigneeName
        createdAt
        updatedAt
        resolvedAt
        location { lat lon }
      }
    }
  `, { status, zone, limit, offset }).then(d => d.incidents);
}

export async function fetchIncidentHotspots(): Promise<HotspotType[]> {
  return gql<{ incidentHotspots: HotspotType[] }>(`
    query IncidentHotspots {
      incidentHotspots {
        zone
        incidentCount
        lat
        lon
      }
    }
  `).then(d => d.incidentHotspots);
}

export async function fetchEquityMetrics(): Promise<EquityMetricType[]> {
  return gql<{ equityMetrics: EquityMetricType[] }>(`
    query EquityMetrics {
      equityMetrics {
        zone
        totalIncidents
        avgResolutionTimeMinutes
      }
    }
  `).then(d => d.equityMetrics);
}

export async function fetchUsers(role?: string, zone?: string, limit = 50, offset = 0): Promise<UserType[]> {
  return gql<{ users: UserType[] }>(`
    query Users($role: String, $zone: String, $limit: Int, $offset: Int) {
      users(role: $role, zone: $zone, limit: $limit, offset: $offset) {
        id
        email
        fullName
        role
        zone
      }
    }
  `, { role, zone, limit, offset }).then(d => d.users);
}

// Mutations

export async function gqlUpdateIncidentStatus(id: string, status: string, note?: string): Promise<MutationResponse> {
  return gql<{ updateIncidentStatus: MutationResponse }>(`
    mutation UpdateIncidentStatus($id: String!, $status: String!, $note: String) {
      updateIncidentStatus(id: $id, status: $status, note: $note) {
        success
        message
        id
      }
    }
  `, { id, status, note }).then(d => d.updateIncidentStatus);
}

export async function gqlAssignIncident(id: string, userId: string, department?: string): Promise<MutationResponse> {
  return gql<{ assignIncident: MutationResponse }>(`
    mutation AssignIncident($id: String!, $userId: String!, $department: String) {
      assignIncident(id: $id, userId: $userId, department: $department) {
        success
        message
        id
      }
    }
  `, { id, userId, department }).then(d => d.assignIncident);
}

export async function gqlBulkUpdateIncidentStatus(ids: string[], status: string): Promise<MutationResponse> {
  return gql<{ bulkUpdateIncidentStatus: MutationResponse }>(`
    mutation BulkUpdateIncidentStatus($ids: [String!]!, $status: String!) {
      bulkUpdateIncidentStatus(ids: $ids, status: $status) {
        success
        message
        id
      }
    }
  `, { ids, status }).then(d => d.bulkUpdateIncidentStatus);
}

export async function gqlSendZoneBroadcast(zone: string, title: string, body: string): Promise<MutationResponse> {
  return gql<{ sendZoneBroadcast: MutationResponse }>(`
    mutation SendZoneBroadcast($zone: String!, $title: String!, $body: String!) {
      sendZoneBroadcast(zone: $zone, title: $title, body: $body) {
        success
        message
        id
      }
    }
  `, { zone, title, body }).then(d => d.sendZoneBroadcast);
}
