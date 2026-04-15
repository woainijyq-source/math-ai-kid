"use client";
/**
 * useScrollVelocityBlur — 滚动速度动态模糊 Hook
 *
 * 监测页面滚动速度，映射为 CSS filter blur 值。
 * 快速滚动时历史气泡轻微模糊，停止滚动恢复清晰。
 * 儿童产品安全：maxBlur 建议 2-3px，绝不超过 4px。
 */

import {
  useScroll,
  useVelocity,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * @param maxBlur          最大模糊像素值（默认 2.5px）
 * @param velocityThreshold 触发最大模糊的速度阈值（像素/秒，默认 2500）
 * @returns MotionValue<string> 格式 "blur(Xpx)"，可直接用于 style={{ filter }}
 */
export function useScrollVelocityBlur(
  maxBlur: number = 2.5,
  velocityThreshold: number = 2500,
): MotionValue<string> {
  const reduced = useReducedMotion();
  // 无障碍：用户偏好减弱动效时，maxBlur 强制为 0
  const effectiveMax = reduced ? 0 : maxBlur;

  // 1. 捕捉 document 的 Y 轴滚动位置（无参数 = document scroll）
  const { scrollY } = useScroll();

  // 2. 计算实时滚动速度（像素/秒）
  const scrollVelocity = useVelocity(scrollY);

  // 3. 将速度映射到模糊数值（向上/向下滚动都触发）
  const rawBlur = useTransform(
    scrollVelocity,
    [-velocityThreshold, 0, velocityThreshold],
    [effectiveMax, 0, effectiveMax],
  );

  // 4. 弹簧平滑过渡，避免抖动
  const smoothBlur = useSpring(rawBlur, {
    stiffness: 400,
    damping: 90,
  });

  // 5. 转换为 CSS filter 字符串
  return useTransform(smoothBlur, (v) => `blur(${v}px)`);
}
