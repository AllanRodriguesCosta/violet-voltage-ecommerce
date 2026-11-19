// Envio de formulário com trava: enquanto um envio está em andamento, outro toque é ignorado; ao
// terminar (com sucesso ou erro) o botão volta e dá para tentar de novo. Usado por
// components/Form.tsx e components/FormKit.tsx (o mesmo comportamento do bindForm anterior).
export type SubmitResult = { status: "skipped" } | { status: "done" } | { status: "failed"; error: Error & { field?: string } };
export function createSubmitGuard(onBusy: (busy: boolean) => void) {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    async run(task: () => unknown): Promise<SubmitResult> {
      if (busy) return { status: "skipped" };
      busy = true;
      onBusy(true);
      try {
        await task();
        return { status: "done" };
      } catch (error) {
        return { status: "failed", error: error as Error & { field?: string } };
      } finally {
        busy = false;
        onBusy(false);
      }
    },
  };
}
