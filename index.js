const core = require("@actions/core");
const { ECS } = require("@aws-sdk/client-ecs");

const ecs = new ECS();

const main = async () => {
  const cluster = core.getInput("cluster", { required: true });
  const service = core.getInput("service", { required: true });
  const group = core.getInput("group", { required: true });
  if (group == "service") {
    throw new Error(`Cannot stop a group called 'service'`);
  }

  try {
    // Get network configuration from aws directly from describe services
    core.debug("Getting information from service");
    const info = await ecs.describeServices({ cluster, services: [service] });
    if (!info || !info.services[0]) {
      // throw new Error(
      //   `Could not find service ${service} in cluster ${cluster}`
      // );
      return;
    }

    const taskDefinition = info.services[0].taskDefinition;
    const taskDefinitionName = taskDefinition
      .split("/")
      .pop()
      .split(":")
      .shift();
    // core.setOutput('task-definition', taskDefinition);

    const existingARNs = await ecs.listTasks({
      cluster,
      family: taskDefinitionName,
    });
    if (
      existingARNs &&
      existingARNs.taskArns &&
      existingARNs.taskArns.length > 0
    ) {
      const existing = await ecs.describeTasks({
        cluster,
        tasks: existingARNs.taskArns,
      });
      if (existing && existing.tasks) {
        const tasksIds = existing.tasks
          .filter((t) => t.group == group + ":" + service)
          .map((t) => t.taskArn.split("/").pop());
        for (let i = 0; i < tasksIds.length; i++) {
          core.info("Stopping task ID " + tasksIds[i]);
          await ecs.stopTask({ cluster, task: tasksIds[i] });
        }
      }
    }
  } catch (error) {
    core.setFailed(error);
  }
};

main();
