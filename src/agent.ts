import { ActionRegistry } from './actions/registry'
import { clickAction } from './actions/click'
import { typeAction } from './actions/type'
import { navigateAction } from './actions/navigate'
import { ActionPlanner, Plan } from './planner/planner'
import { DOMObserver } from './dom/observer'
import { captureSnapshot, DOMSnapshot } from './dom/snapshot'
import { serializePage } from './utils/serializer'

// 1. Mejora #3: Añadir maxSteps opcional a la configuración
export interface AgentConfig {
  llmCall: (prompt: string) => Promise<string>
  verbose?: boolean
  maxSteps?: number // Nuevo campo configurable
}

export class BrowserAgent {
  private registry: ActionRegistry
  private planner: ActionPlanner
  private observer: DOMObserver
  private config: AgentConfig

  constructor(config: AgentConfig) {
    this.config = config
    this.registry = new ActionRegistry()
    this.observer = new DOMObserver()

    // register built-in actions
    this.registry.register(clickAction)
    this.registry.register(typeAction)
    this.registry.register(navigateAction)

    // Usar config.maxSteps si existe, si no usar default 10
    const stepsToUse = config.maxSteps ?? 10; 

    this.planner = new ActionPlanner(this.registry, {
      llmCall: config.llmCall,
      maxSteps: stepsToUse,
    })
  }

  /**
   * execute a goal described in natural language
   */
  async run(goal: string): Promise<{ success: boolean; results: any[]; error?: string }> {
    this.observer.start();

    try {
      // Validación básica de entrada
      if (!goal || typeof goal !== 'string') {
        throw new Error("Goal must be a non-empty string");
      }

      if (this.config.verbose) {
        console.log(`[BrowserAgent] goal: ${goal}`);
        console.log(`[BrowserAgent] planning...`);
      }

      const plan = await this.planner.plan(goal);

      if (this.config.verbose) {
        console.log(`[BrowserAgent] plan:`, plan.steps.map(s => `${s.action}: ${s.reasoning}`));
      }

      // Ejecutar plan (asumiendo que executePlan maneja sus propios errores internos)
      const results = await this.planner.executePlan(plan);

      // Verificar fallos parciales
      const hasErrors = results.some(r => !r.success && r.error);

      return { 
        success: results.every(r => r.success), 
        results,
        ...(hasErrors ? { error: "One or more execution steps failed" } : {})
      };

    } catch (error) {
      // 2. Mejora #1: Capturar errores críticos y devolverlos limpiamente
      console.error('[BrowserAgent] Critical failure during execution:', error);
      
      // Retorna mensaje de error legible
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { 
        success: false, 
        results: [], 
        error: errorMsg 
      };
    } finally {
      this.observer.stop();
    }
  }

  /**
   * get a snapshot of the current page state
   */
  snapshot(): DOMSnapshot {
    return captureSnapshot();
  }

  /**
   * get a text description of the page (for LLM context)
   */
  describe(): string {
    return serializePage();
  }

  /**
   * register a custom action
   */
  registerAction(action: Parameters<ActionRegistry['register']>[0]): void {
    this.registry.register(action);
  }

  /**
   * get list of DOM changes since last check
   */
  getChanges() {
    const changes = this.observer.getChanges();
    this.observer.clearChanges();
    return changes;
  }
}
