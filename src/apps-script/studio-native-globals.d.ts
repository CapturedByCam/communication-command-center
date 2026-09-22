// Narrow runtime declarations for official Studio services absent from installed typings.
// https://developers.google.com/workspace/add-ons/studio/build-a-step
// https://developers.google.com/apps-script/reference/add-ons-response-service

declare namespace GoogleAppsScript.Card_Service {
  interface WorkflowDataSource {
    setIncludeVariables(value: boolean): WorkflowDataSource;
  }
  interface HostAppDataSource {
    setWorkflowDataSource(value: WorkflowDataSource): HostAppDataSource;
  }
  interface TextInput {
    setHostAppDataSource(value: HostAppDataSource): TextInput;
    setInputMode(value: TextInputMode): TextInput;
  }
  enum TextInputMode {
    PLAIN_TEXT,
    RICH_TEXT,
  }
  interface CardService {
    TextInputMode: typeof TextInputMode;
    newHostAppDataSource(): HostAppDataSource;
    newWorkflowDataSource(): WorkflowDataSource;
  }
}

interface StudioVariableData {
  addStringValue(value: string): StudioVariableData;
}
interface StudioReturnVariables {
  addVariableData(id: string, data: StudioVariableData): StudioReturnVariables;
}
interface StudioHostAction {
  setWorkflowAction(action: StudioReturnVariables): StudioHostAction;
}
interface StudioRenderBuilder {
  setHostAppAction(action: StudioHostAction): StudioRenderBuilder;
  build(): unknown;
}
declare const AddOnsResponseService: {
  newVariableData(): StudioVariableData;
  newReturnOutputVariablesAction(): StudioReturnVariables;
  newHostAppAction(): StudioHostAction;
  newRenderActionBuilder(): StudioRenderBuilder;
};
