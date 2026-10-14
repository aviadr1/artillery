const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkFargateResourceConfig,
  normalizeEcsCpu,
  normalizeEcsMemory
} = require('../../lib/platform/aws-ecs/legacy/resource-config.ts');

for (const memoryGiB of [60, 120, 244]) {
  test(`32 vCPU accepts ${memoryGiB} GiB in shorthand and ECS units`, () => {
    for (const cpu of [32, 32768]) {
      for (const memory of [String(memoryGiB), String(memoryGiB * 1024)]) {
        const normalizedCpu = normalizeEcsCpu(cpu);
        const normalizedMemory = Number(normalizeEcsMemory(memory));
        assert.equal(normalizedCpu, 32768);
        assert.equal(normalizedMemory, memoryGiB * 1024);
        assert.equal(
          checkFargateResourceConfig(normalizedCpu, normalizedMemory),
          null
        );
      }
    }
  });

  test(`32 vCPU accepts explicit launch-config memory ${memoryGiB} GiB`, () => {
    assert.equal(checkFargateResourceConfig(32768, memoryGiB * 1024), null);
  });
}

// These are discrete AWS sizes, not an interval with an eight-GiB increment.
for (const memoryGiB of [32, 59, 61, 64, 119, 121, 128, 240, 243, 245]) {
  test(`32 vCPU rejects unsupported ${memoryGiB} GiB`, () => {
    assert.match(
      checkFargateResourceConfig(32768, memoryGiB * 1024).message,
      /Fargate memory override for cpu = 32768 must be one of: 61440, 122880, 249856/
    );
  });
}

test('existing Fargate sizes retain their unit conversions and valid memory ranges', () => {
  const configurations = [
    { cpu: 0.25, memory: [0.5, 1, 2] },
    { cpu: 0.5, memory: [1, 2, 3, 4] },
    { cpu: 1, memory: [2, 3, 4, 5, 6, 7, 8] },
    { cpu: 2, min: 4, max: 16, step: 1 },
    { cpu: 4, min: 8, max: 30, step: 1 },
    { cpu: 8, min: 16, max: 60, step: 4 },
    { cpu: 16, min: 32, max: 120, step: 8 }
  ];
  for (const config of configurations) {
    const memories =
      config.memory ||
      Array.from(
        { length: (config.max - config.min) / config.step + 1 },
        (_, index) => config.min + index * config.step
      );
    for (const memoryGiB of memories) {
      const cpuUnits = config.cpu * 1024;
      const memoryMiB = memoryGiB * 1024;
      assert.equal(normalizeEcsCpu(config.cpu), cpuUnits);
      assert.equal(normalizeEcsCpu(cpuUnits), cpuUnits);
      assert.equal(normalizeEcsMemory(String(memoryMiB)), String(memoryMiB));
      // The existing CLI uses integral GiB shorthand; 512 MiB is passed explicitly.
      if (Number.isInteger(memoryGiB)) {
        assert.equal(normalizeEcsMemory(String(memoryGiB)), String(memoryMiB));
      }
      assert.equal(checkFargateResourceConfig(cpuUnits, memoryMiB), null);
    }
  }
});

test('larger memory does not become valid on smaller CPU sizes', () => {
  assert.match(
    checkFargateResourceConfig(16384, 244 * 1024).message,
    /memory override/
  );
  assert.match(
    checkFargateResourceConfig(8192, 120 * 1024).message,
    /memory override/
  );
});

test('unsupported CPU allocations remain rejected', () => {
  for (const cpu of [0, 3, 24, 64]) {
    assert.match(
      checkFargateResourceConfig(normalizeEcsCpu(cpu), 60 * 1024).message,
      /Unsupported cpu override/
    );
  }
});
