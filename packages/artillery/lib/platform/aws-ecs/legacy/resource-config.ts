// CLI flags accept either human-readable vCPU/GiB values or ECS CPU units/MiB.
export function normalizeEcsCpu(cpu: number): number {
  const MAX_VCPUS = 32;
  return cpu <= MAX_VCPUS ? cpu * 1024 : cpu;
}

export function normalizeEcsMemory(memory: string): string {
  const MAX_MEMORY_IN_GB = 244;
  return Number(memory) <= MAX_MEMORY_IN_GB
    ? String(parseInt(memory, 10) * 1024)
    : memory;
}

export function checkFargateResourceConfig(cpu: number, memory: number) {
  function generateListOfOptionsMiB(
    minGB: number,
    maxGB: number,
    incrementGB: number
  ) {
    const result: number[] = [];
    for (let i = 0; i <= (maxGB - minGB) / incrementGB; i++) {
      result.push((minGB + incrementGB * i) * 1024);
    }

    return result;
  }

  // Based on https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html#fargate-tasks-size
  const FARGATE_VALID_CONFIGS: Record<number, number[]> = {
    256: [512, 1024, 2048],
    512: [1024, 2048, 3072, 4096],
    1024: [2048, 3072, 4096, 5120, 6144, 7168, 8192],
    2048: generateListOfOptionsMiB(4, 16, 1),
    4096: generateListOfOptionsMiB(8, 30, 1),
    8192: generateListOfOptionsMiB(16, 60, 4),
    16384: generateListOfOptionsMiB(32, 120, 8),
    32768: [60 * 1024, 120 * 1024, 244 * 1024]
  };

  if (!FARGATE_VALID_CONFIGS[cpu]) {
    return new Error(
      `Unsupported cpu override for Fargate. Must be one of: ${Object.keys(
        FARGATE_VALID_CONFIGS
      ).join(', ')}`
    );
  }

  if (FARGATE_VALID_CONFIGS[cpu].indexOf(memory) < 0) {
    return new Error(
      `Fargate memory override for cpu = ${cpu} must be one of: ${FARGATE_VALID_CONFIGS[
        cpu
      ].join(', ')}`
    );
  }

  return null;
}
