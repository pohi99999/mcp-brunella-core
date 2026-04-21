/**
 * Gold Protocol G7.1: Spec Manager Panel
 *
 * Dashboard komponens az összes track spec státuszának kezelésére.
 * RULE-UI2: Valós idejű frissítések Socket.IO-n keresztül
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, Clock, FileText } from '@phosphor-icons/react';

interface SpecMeta {
  id: string;
  title: string;
  status: string;
  spec_status: 'pending_approval' | 'approved' | 'rejected' | 'not_found';
  priority: string;
  created: string;
  updated: string;
  owner: string;
  progress: number;
  tags: string[];
  rejection_reason?: string;
}

export function SpecManagerPanel() {
  const [specs, setSpecs] = useState<SpecMeta[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [specDetails, setSpecDetails] = useState<{ specContent: string; planContent: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecs();
    const interval = setInterval(fetchSpecs, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchSpecs = async () => {
    try {
      const res = await fetch('/api/specs');
      const data = await res.json();
      setSpecs(data.specs || []);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch specs:', e);
      setLoading(false);
    }
  };

  const fetchSpecDetails = async (trackId: string) => {
    try {
      const res = await fetch(`/api/specs/${trackId}`);
      const data = await res.json();
      setSpecDetails({
        specContent: data.specContent || 'No spec.md found',
        planContent: data.planContent || 'No plan.md found',
      });
      setSelectedTrack(trackId);
    } catch (e) {
      console.error('Failed to fetch spec details:', e);
    }
  };

  const handleApprove = async (trackId: string) => {
    try {
      const res = await fetch(`/api/specs/${trackId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchSpecs(); // Refresh list
        alert(`✅ Spec approved: ${trackId}`);
      } else {
        alert(`❌ Failed to approve: ${data.message}`);
      }
    } catch (e) {
      alert('Failed to approve spec');
    }
  };

  const handleReject = async (trackId: string) => {
    const reason = prompt('Rejection reason (optional):');
    try {
      const res = await fetch(`/api/specs/${trackId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSpecs();
        alert(`❌ Spec rejected: ${trackId}`);
      } else {
        alert(`Failed to reject: ${data.message}`);
      }
    } catch (e) {
      alert('Failed to reject spec');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'pending_approval':
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white">Unknown</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-600',
      high: 'bg-orange-500',
      medium: 'bg-blue-500',
      low: 'bg-gray-400',
    };
    return <Badge className={`${colors[priority.toLowerCase()] || 'bg-gray-500'} text-white`}>{priority.toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spec Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-500">Loading specs...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left Panel: Spec List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Track Specifications ({specs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {specs.map((spec) => (
              <div
                key={spec.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  selectedTrack === spec.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300'
                }`}
                onClick={() => fetchSpecDetails(spec.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{spec.title}</h3>
                    <p className="text-xs text-gray-500">ID: {spec.id}</p>
                  </div>
                  {getStatusBadge(spec.spec_status)}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {getPriorityBadge(spec.priority)}
                  <Badge className="bg-gray-200 text-gray-700">Progress: {spec.progress}%</Badge>
                  <span className="text-gray-500">Updated: {spec.updated}</span>
                </div>
                {spec.rejection_reason && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                    Reason: {spec.rejection_reason}
                  </div>
                )}
                {spec.spec_status === 'pending_approval' && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleApprove(spec.id); }}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleReject(spec.id); }}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Right Panel: Spec Details */}
      <Card>
        <CardHeader>
          <CardTitle>Spec Details</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTrack && specDetails ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Specification (spec.md)</h3>
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs max-h-[250px] overflow-y-auto font-mono whitespace-pre-wrap">
                  {specDetails.specContent}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Implementation Plan (plan.md)</h3>
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs max-h-[250px] overflow-y-auto font-mono whitespace-pre-wrap">
                  {specDetails.planContent}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center p-8">
              Select a track to view spec details
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
