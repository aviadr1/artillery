const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkFargateResourceConfig,
  normalizeEcsCpu,
  normalizeEcsMemory
} = require('../../lib/platform/aws-ecs/legacy/run-cluster.ts');

for (const memoryGiB of [60, 120, 244]) {
  test(`32 vCPU accepts ${memoryGiB} GiB in shorthand and ECS units`, () => {
    for (const cpu of [32, 32768]) {
      for (const memory of [String(memoryGiB), String(memoryGiB * 1024)]) {
        const normalizedCpu = normalizeEcsCpu(cpu);
        const normalizedMemory = Number(normalizeEcsMemory(memory));
        assert.equal(normalizedCpu, 32768);
        assert.equal(normalizedMemory, memoryGiB * 1024);
        assert.equal(checkFargateResourceConfig(normalizedCpu, normalizedMemory), null);
      }
    }
  });
}

test('32 vCPU memory sizes are discrete, not a range', () => {
  for (const memoryGiB of [32, 59, 61, 64, 119, 121, 128, 240, 243, 245]) {
    assert.match(checkFargateResourceConfig(32768, memoryGiB * 1024).message, /memory override/);
  }
});

test('existing sizes and unit conversions remain supported', () => {
  for (const [cpu, memory] of [[0.25, 512], [0.5, 1024], [1, 2048], [2, 4096], [4, 8192], [8, 61440], [16, 122880]]) {
    assert.equal(normalizeEcsCpu(cpu), cpu * 1024);
    assert.equal(normalizeEcsCpu(cpu * 1024), cpu * 1024);
    assert.equal(normalizeEcsMemory(String(memory)), String(memory));
    assert.equal(checkFargateResourceConfig(cpu * 1024, memory), null);
  }
  assert.equal(normalizeEcsMemory('120'), '122880');
  assert.match(checkFargateResourceConfig(16384, 244 * 1024).message, /memory override/);
});

test('unsupported CPUs remain rejected', () => {
  for (const cpu of [0, 3, 24, 64]) {
    assert.match(checkFargateResourceConfig(normalizeEcsCpu(cpu), 61440).message, /Unsupported cpu/);
  }
});
