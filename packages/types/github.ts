/**
 * GitHub Webhook Types
 * 
 * Type definitions for GitHub webhook payloads
 * Reference: https://docs.github.com/en/developers/webhooks-and-events
 */

/**
 * GitHub Workflow Run Event
 * Triggered when a workflow run is requested or completed
 */
export interface GitHubWorkflowRunPayload {
  action: 'requested' | 'completed' | 'rerequested' | 'deleted';
  workflow_run: {
    id: number;
    name: string;
    node_id: string;
    head_branch: string;
    head_sha: string;
    path: string;
    display_title: string;
    run_number: number;
    event: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | null;
    workflow_id: number;
    check_suite_id: number;
    check_suite_node_id: string;
    url: string;
    html_url: string;
    pull_requests: Array<{
      url: string;
      id: number;
      number: number;
      head: {
        ref: string;
        sha: string;
      };
      base: {
        ref: string;
        sha: string;
      };
    }>;
    created_at: string;
    updated_at: string;
    actor: {
      login: string;
      id: number;
      node_id: string;
      avatar_url: string;
      gravatar_id: string;
      url: string;
      html_url: string;
      followers_url: string;
      following_url: string;
      gists_url: string;
      starred_url: string;
      subscriptions_url: string;
      organizations_url: string;
      repos_url: string;
      events_url: string;
      received_events_url: string;
      type: string;
      site_admin: boolean;
    };
    run_attempt: number;
    referenced_workflows: Array<unknown>;
    run_started_at: string;
    triggering_actor: {
      login: string;
      type: string;
    };
    jobs_url: string;
    logs_url: string;
    checks_url: string;
    artifacts_url: string;
    cancel_url: string;
    rerun_url: string;
    previous_attempt_url: string | null;
    workflow_url: string;
    head_commit: {
      id: string;
      tree_id: string;
      message: string;
      timestamp: string;
      author: {
        name: string;
        email: string;
      };
      committer: {
        name: string;
        email: string;
      };
    };
    repository: {
      id: number;
      node_id: string;
      name: string;
      full_name: string;
      private: boolean;
      owner: {
        login: string;
        id: number;
        type: string;
        avatar_url: string;
      };
      html_url: string;
      description: string | null;
      fork: boolean;
      created_at: string;
      updated_at: string;
      pushed_at: string;
      homepage: string | null;
      size: number;
      stargazers_count: number;
      watchers_count: number;
      language: string | null;
      forks_count: number;
      open_issues_count: number;
      default_branch: string;
      url: string;
    };
    organization: {
      login: string;
      id: number;
      node_id: string;
      url: string;
      repos_url: string;
      events_url: string;
      hooks_url: string;
      issues_url: string;
      members_url: string;
      public_members_url: string;
      avatar_url: string;
      description: string | null;
      display_login: string;
      gravatar_id: string;
      name: string | null;
      company: string | null;
      blog: string;
      location: string | null;
      email: string | null;
      twitter_username: string | null;
      is_verified: boolean;
      has_organization_projects: boolean;
      has_repository_projects: boolean;
      public_repos: number;
      public_gists: number;
      followers: number;
      following: number;
      html_url: string;
      created_at: string;
      updated_at: string;
      type: string;
      total_private_repos: number;
      owned_private_repos: number;
      private_gists: number | null;
      disk_usage: number | null;
      collaborators: number | null;
      billing_email: string | null;
    };
  };
}

/**
 * GitHub Pull Request Event
 * Triggered when a pull request is opened, closed, reopened, synchronize, etc.
 */
export interface GitHubPullRequestPayload {
  action: 'opened' | 'closed' | 'reopened' | 'synchronize' | 'converted_to_draft' | 'ready_for_review' | 'labeled' | 'unlabeled' | 'assigned' | 'unassigned' | 'edited' | 'auto_merge_enabled' | 'auto_merge_disabled' | 'locked' | 'unlocked';
  number: number;
  pull_request: {
    url: string;
    id: number;
    node_id: string;
    html_url: string;
    state: 'open' | 'closed';
    title: string;
    user: {
      login: string;
      id: number;
      type: string;
      avatar_url: string;
    };
    body: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    merge_commit_sha: string | null;
    assignee: {
      login: string;
      id: number;
    } | null;
    assignees: Array<{
      login: string;
      id: number;
    }>;
    requested_reviewers: Array<unknown>;
    requested_teams: Array<unknown>;
    labels: Array<{
      id: number;
      node_id: string;
      url: string;
      name: string;
      color: string;
      default: boolean;
      description: string;
    }>;
    milestone: unknown | null;
    draft: boolean;
    head: {
      label: string;
      ref: string;
      sha: string;
      user: {
        login: string;
        id: number;
      };
      repo: {
        id: number;
        name: string;
        full_name: string;
      };
    };
    base: {
      label: string;
      ref: string;
      sha: string;
      user: {
        login: string;
        id: number;
      };
      repo: {
        id: number;
        name: string;
        full_name: string;
      };
    };
    locked: boolean;
    merged: boolean;
    mergeable: boolean | null;
    mergeable_state: string;
    merged_by: {
      login: string;
      id: number;
    } | null;
    comments: number;
    review_comments: number;
    maintainer_can_modify: boolean;
    commits: number;
    additions: number;
    deletions: number;
    changed_files: number;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      id: number;
    };
  };
}

/**
 * GitHub Check Run Event
 * Triggered when a check run is created or updated
 */
export interface GitHubCheckRunPayload {
  action: 'created' | 'rerequested' | 'completed' | 'requested_action';
  check_run: {
    id: number;
    node_id: string;
    name: string;
    head_sha: string;
    external_id: string;
    url: string;
    html_url: string;
    details_url: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
    started_at: string;
    completed_at: string | null;
    output: {
      title: string;
      summary: string;
      text: string;
      annotations_count: number;
      annotations_url: string;
    };
    output_annotations: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: 'notice' | 'warning' | 'failure';
      title: string;
      message: string;
    }>;
    pull_requests: Array<{
      url: string;
      id: number;
      number: number;
      head: {
        sha: string;
        ref: string;
      };
      base: {
        sha: string;
        ref: string;
      };
    }>;
    app: {
      id: number;
      slug: string;
      node_id: string;
      owner: {
        login: string;
        id: number;
      };
      name: string;
      description: string | null;
      external_url: string;
      html_url: string;
      created_at: string;
      updated_at: string;
      permissions: Record<string, string>;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      id: number;
    };
  };
}

/**
 * Jules Fix Workflow Status
 * Tracks the status of automated fix generation and deployment
 */
export interface JulesFixWorkflowStatus {
  id: string;
  type: 'workflow_fix' | 'pr_auto_merge';
  status: 'analyzing' | 'generating' | 'committing' | 'complete' | 'failed';
  workflowRunId: number;
  errorType?: 'build' | 'test' | 'lint' | 'deploy' | 'unknown';
  confidence?: number;
  prNumber?: number;
  branchName?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Deployment Error Analysis Result
 */
export interface DeploymentErrorAnalysis {
  type: 'build' | 'test' | 'lint' | 'deploy' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  context?: string;
  confidence: number;
  suggestedFix?: string;
  affectedFiles?: string[];
}
