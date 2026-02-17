import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * UX/UI Design Specification
 */
interface DesignSpec {
  projectName: string;
  targetAudience: string;
  colorPalette: string[];
  typography: {
    heading: string;
    body: string;
    monospace?: string;
  };
  layout: 'grid' | 'flex' | 'sidebar' | 'dashboard' | 'landing';
  components: ComponentDesign[];
  wireframe?: string; // ASCII or mermaid diagram
  accessibilityLevel: 'AA' | 'AAA';
  responsiveBreakpoints: ('mobile' | 'tablet' | 'desktop')[];
}

interface ComponentDesign {
  name: string;
  type: 'button' | 'form' | 'card' | 'modal' | 'nav' | 'table' | 'chart' | 'input';
  description: string;
  props?: Record<string, string>;
  variants?: string[];
  a11yNotes?: string;
}

/**
 * UXDesignerAgent - Software Genesis Phase 4
 * Generates UX/UI design specifications, component blueprints, and wireframes
 */
export class UXDesignerAgent implements IAgent {
  name = 'UXDesigner';
  role = 'User Experience Designer Agent';
  description = 'UX/UI design specifikációk generálása - Wireframe, komponensek, accessibility';
  capabilities = [
    'design_spec_generation',
    'component_blueprint',
    'wireframe_creation',
    'accessibility_audit',
    'design_system_creation'
  ];

  /**
   * Generate design spec from blueprint
   */
  private generateDesignSpec(blueprint: Record<string, unknown>): DesignSpec {
    const projectName = (blueprint.projectName as string) || 'Untitled Project';
    const targetAudience = (blueprint.targetAudience as string) || 'General users';
    const features = (blueprint.features as string[]) || [];

    // Infer color palette from project type
    let colorPalette: string[] = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];
    if (projectName.toLowerCase().includes('finance') || projectName.toLowerCase().includes('bank')) {
      colorPalette = ['#1E40AF', '#059669', '#DC2626', '#475569', '#F59E0B'];
    } else if (projectName.toLowerCase().includes('health') || projectName.toLowerCase().includes('medical')) {
      colorPalette = ['#0891B2', '#059669', '#EF4444', '#7C3AED', '#F59E0B'];
    }

    // Infer layout from features
    let layout: 'grid' | 'flex' | 'sidebar' | 'dashboard' | 'landing' = 'grid';
    if (features.some(f => String(f).toLowerCase().includes('dashboard') || String(f).toLowerCase().includes('analytics'))) {
      layout = 'dashboard';
    } else if (features.some(f => String(f).toLowerCase().includes('admin') || String(f).toLowerCase().includes('manage'))) {
      layout = 'sidebar';
    } else if (features.length <= 3) {
      layout = 'landing';
    }

    // Generate component designs
    const components: ComponentDesign[] = features.map((feature) => {
      const featureStr = String(feature).toLowerCase();
      let type: ComponentDesign['type'] = 'card';

      if (featureStr.includes('form') || featureStr.includes('login') || featureStr.includes('register')) {
        type = 'form';
      } else if (featureStr.includes('table') || featureStr.includes('list')) {
        type = 'table';
      } else if (featureStr.includes('chart') || featureStr.includes('graph')) {
        type = 'chart';
      } else if (featureStr.includes('button') || featureStr.includes('action')) {
        type = 'button';
      } else if (featureStr.includes('navigation') || featureStr.includes('menu')) {
        type = 'nav';
      }

      return {
        name: `${String(feature).replace(/\s+/g, '')}Component`,
        type,
        description: `Component for ${feature} functionality`,
        props: {
          variant: type === 'button' ? 'primary|secondary|outline' : 'default',
          size: 'sm|md|lg'
        },
        variants: type === 'button' ? ['primary', 'secondary', 'outline', 'ghost'] : undefined,
        a11yNotes: type === 'form' ? 'Use semantic labels, ARIA attributes, keyboard navigation' : 
                   type === 'button' ? 'focus-visible ring, aria-label for icon-only buttons' : undefined
      };
    });

    // Add common components
    components.push(
      {
        name: 'Header',
        type: 'nav',
        description: 'Main navigation header',
        a11yNotes: 'Landmark nav, skip links, mobile hamburger keyboard accessible'
      },
      {
        name: 'Footer',
        type: 'nav',
        description: 'Site footer with links',
        a11yNotes: 'Footer landmark, link contrast ratio WCAG AA'
      }
    );

    // Generate simple wireframe (ASCII art)
    const wireframe = this.generateWireframe(layout, projectName);

    return {
      projectName,
      targetAudience,
      colorPalette,
      typography: {
        heading: 'Inter, system-ui, sans-serif',
        body: 'Inter, system-ui, sans-serif',
        monospace: 'JetBrains Mono, Fira Code, monospace'
      },
      layout,
      components,
      wireframe,
      accessibilityLevel: 'AA',
      responsiveBreakpoints: ['mobile', 'tablet', 'desktop']
    };
  }

  /**
   * Generate ASCII wireframe
   */
  private generateWireframe(layout: string, projectName: string): string {
    if (layout === 'dashboard') {
      return `
┌──────────────────────────────────────────┐
│  ${projectName} - Dashboard           │
├──────┬───────────────────────────────────┤
│ NAV  │  Header / Search              [👤]│
│      ├───────────────────────────────────┤
│ •Home│  ┌───────┐  ┌───────┐  ┌───────┐ │
│ •Data│  │Widget │  │Widget │  │Widget │ │
│ •Logs│  │   1   │  │   2   │  │   3   │ │
│ •Cfg │  └───────┘  └───────┘  └───────┘ │
│      │  ┌─────────────────────────────┐ │
│      │  │   Main Content / Table      │ │
│      │  └─────────────────────────────┘ │
├──────┴───────────────────────────────────┤
│  Footer - © 2026                         │
└──────────────────────────────────────────┘
`;
    } else if (layout === 'landing') {
      return `
┌──────────────────────────────────────────┐
│  [Logo] ${projectName}        [Nav] [CTA]│
├──────────────────────────────────────────┤
│                                          │
│        ══ Hero Section ══                │
│     "Catchy Tagline Here"                │
│         [Primary CTA]                    │
│                                          │
├──────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │ Feat │  │ Feat │  │ Feat │           │
│  │  1   │  │  2   │  │  3   │           │
│  └──────┘  └──────┘  └──────┘           │
├──────────────────────────────────────────┤
│  Footer - Links, Social, © 2026          │
└──────────────────────────────────────────┘
`;
    } else {
      return `
┌──────────────────────────────────────────┐
│  ${projectName} Header               [👤]│
├──────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐         │
│  │  Content   │  │  Content   │         │
│  │  Block 1   │  │  Block 2   │         │
│  └────────────┘  └────────────┘         │
│  ┌─────────────────────────────────┐    │
│  │     Main Content Area           │    │
│  └─────────────────────────────────┘    │
├──────────────────────────────────────────┤
│  Footer                                  │
└──────────────────────────────────────────┘
`;
    }
  }

  /**
   * Execute design task
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `🎨 UX Design feladat: ${task.slice(0, 40)}...`);

      if (task.toLowerCase().includes('design') || task.toLowerCase().includes('wireframe') || task.toLowerCase().includes('ux')) {
        const blueprint = (context as Record<string, unknown>) || {};

        if (!blueprint.projectName) {
          return {
            status: 'error',
            error: 'Nincs projectName megadva a blueprint-ben.'
          };
        }

        const designSpec = this.generateDesignSpec(blueprint);

        logInfo(this.name, `✅ Design spec generálva: ${designSpec.components.length} component`);

        return {
          success: true,
          status: 'success',
          message: `🎨 UX/UI design spec kész! ${designSpec.components.length} komponens, ${designSpec.layout} layout`,
          data: designSpec
        };
      }

      // Accessibility audit
      if (task.toLowerCase().includes('accessibility') || task.toLowerCase().includes('a11y')) {
        return {
          success: true,
          status: 'success',
          message: '♿ Accessibility audit: WCAG AA compliance check',
          data: {
            level: 'AA',
            checks: [
              'Color contrast ratios (4.5:1 for text)',
              'Keyboard navigation support',
              'Screen reader compatibility (ARIA labels)',
              'Focus indicators (focus-visible)',
              'Semantic HTML (nav, main, footer landmarks)'
            ],
            recommendations: [
              'Use @radix-ui/react-* for accessible primitives',
              'Test with VoiceOver (Mac) or NVDA (Windows)',
              'Add skip-to-content links',
              'Ensure form labels are programmatically associated'
            ]
          }
        };
      }

      return {
        status: 'error',
        error: 'Ismeretlen UX feladat. Használd: "generate design spec" vagy "accessibility audit"'
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
