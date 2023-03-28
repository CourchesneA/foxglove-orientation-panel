import { PanelExtensionContext, RenderState, Topic, MessageEvent, SettingsTreeAction } from "@foxglove/studio";
import { useLayoutEffect, useEffect, useState, useMemo, useCallback, useRef} from "react";
import ReactDOM from "react-dom";
import produce from "immer";
import { set } from "lodash";
import { Quaternion } from "@foxglove/schemas";
import compassRose from "../imgs/compass_rose.png";
import arrow from "../imgs/arrow_blue.png";
import Quat from "quaternion";

type PanelState = {
  data : {
    topic?: string;
  };
};

type ImuMessage = {
  angular_velocity: {
    x: number;
    y: number;
    z: number;
  };
  angular_velocity_covariance: number[];
  linear_acceleration: {
    x: number;
    y: number;
    z: number;
  };
  linear_acceleration_covariance: number[];
  orientation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  orientation_covariance: number[];
}

function OrientationPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [message, setMessage] = useState<MessageEvent<unknown> | undefined>();
  

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const [state, setState] = useState<PanelState>(() => {
    const partialState = context.initialState as Partial<PanelState>;
    return {
      data: {
        topic: partialState.data?.topic ?? "/heading",
      }
    };
  });

  const orientationTopics = useMemo(
    () => (topics ?? []).filter((topic) => topic.schemaName === "sensor_msgs/msg/Imu" || topic.schemaName === "geometry_msgs/msg/Quaternion"),
    [topics],
  );

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        // We use a combination of immer and lodash to produce a new state object
        // so react will re-render our panel.
        setState(produce((draft) => set(draft, path, value)));

        // If the topic was changed update our subscriptions.
        if (path[1] === "topic") {
          context.subscribe([{ topic: value as string }]);
        }
      }
    },
    [context],
  );

  // update setting editor when state or topics change
  useEffect(() => {
    context.saveState(state);
    const topicOptions = (orientationTopics ?? []).map((topic) => ({ value: topic.name, label: topic.name }));
    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        data: {
          label: "Data",
          icon: "Cube",
          fields: {
            topic: {
              label: "Topic",
              input: "select",
              options: topicOptions,
              value: state.data.topic,
            },
          },
        },
      },
    });
  }, [context, actionHandler, state, topics]);

  useEffect(() => {
    context.saveState({ topic: state.data.topic });
    if (state.data.topic) {
      context.subscribe([state.data.topic]);
    }
  }, [context, state.data.topic]);


  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {
    // The render handler is run by the broader studio system during playback when your panel
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // You can only setup one render handler - usually early on in setting up your panel.
    //
    // Without a render handler your panel will never receive updates.
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    context.onRender = (renderState: RenderState, done) => {

      setRenderDone(() => done);

      setTopics(renderState.topics);

      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        setMessage(renderState.currentFrame[renderState.currentFrame.length - 1]);
      }
    };

    context.watch("topics");

    context.watch("currentFrame");
  }, [context]);

  
  const arrowRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Get orientation from quaternion then set rotation on arrow
    // console.log("message", message)
    if (message) {
      let quaternion = {} as Quaternion;
      if (message.schemaName === "sensor_msgs/msg/Imu") {
        
        let imuMessage = message.message as ImuMessage;
        quaternion = imuMessage.orientation as Quaternion;
      } else if (message.schemaName === "geometry_msgs/msg/Quaternion") {
        quaternion = message.message as Quaternion;
      }
      // console.log("quaternion", quaternion);
      const quat = new Quat( quaternion.w, quaternion.x, quaternion.y, quaternion.z,);
      const euler = quat.toEuler();
      // console.log("euler", euler);
      const rotationdeg = -1 * euler.yaw * (180 / Math.PI);
      // const rotationdeg = euler.roll * (180 / Math.PI);
      // console.log("rotationdeg", rotationdeg)
      arrowRef.current!.style.transform = `rotate(${rotationdeg}deg)`;
    }
  }, [message]);
  
  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);
  
  return (
    <div style={{ height: "100%", padding: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", backgroundColor:"white", position: 'relative'}}>
        <img src={compassRose} style={{ width: "100%"}}/>
        <img src={arrow} ref={arrowRef} id="arrow" alt="Arrow"
          style={{
            width:'100%',
          position: 'absolute'
        }}
      />
        
      </div>
    </div>
  );
}

export function initOrientationPanel(context: PanelExtensionContext): void {
  ReactDOM.render(<OrientationPanel context={context} />, context.panelElement);
}
