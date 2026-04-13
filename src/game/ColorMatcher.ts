/**
 * 色彩匹配系统
 * 处理玩家输入和色彩匹配逻辑
 */

import { ColorType } from "@game/types";

/**
 * 颜色与RGB值的映射
 */
export const colorMap: Record<ColorType, [number, number, number]> = {
  [ColorType.RED]: [255, 0, 0],
  [ColorType.GREEN]: [0, 255, 0],
  [ColorType.BLUE]: [68, 136, 255],
  [ColorType.YELLOW]: [255, 215, 0],
  [ColorType.PURPLE]: [128, 0, 128],
  [ColorType.CYAN]: [0, 255, 255],
  [ColorType.PINK]: [255, 93, 160],
  [ColorType.ORANGE]: [255, 165, 0],
  [ColorType.WHITE]: [255, 255, 255],
};

/**
 * 颜色与十六进制值的映射
 */
export const colorHexMap: Record<ColorType, string> = {
  [ColorType.RED]: "#FF0000",
  [ColorType.GREEN]: "#00FF00",
  [ColorType.BLUE]: "#4488FF",
  [ColorType.YELLOW]: "#FFD700",
  [ColorType.PURPLE]: "#800080",
  [ColorType.CYAN]: "#00FFFF",
  [ColorType.PINK]: "#FF5DA0",
  [ColorType.ORANGE]: "#FFA500",
  [ColorType.WHITE]: "#FFFFFF",
};

/**
 * 检查两个颜色是否匹配
 * @param color1 第一个颜色
 * @param color2 第二个颜色
 * @returns 是否匹配
 */
export function matchColor(color1: ColorType, color2: ColorType): boolean {
  return color1 === color2;
}

/**
 * 根据数值计算分数奖励
 * @param basePoints 基础分数
 * @param isEdgeLane 是否在边车道（有额外分数）
 * @returns 总分数
 */
export function calculateRewardPoints(
  basePoints: number,
  isEdgeLane: boolean,
): number {
  return basePoints + (isEdgeLane ? 5 : 0);
}

/**
 * 将RGB转换为十六进制
 * @param r 红色值（0-255）
 * @param g 绿色值（0-255）
 * @param b 蓝色值（0-255）
 * @returns 十六进制颜色值
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * 将十六进制转换为RGB
 * @param hex 十六进制颜色值
 * @returns RGB数组
 */
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

/**
 * 获取颜色的亮度值（用于判定深色/浅色）
 * @param color 颜色类型
 * @returns 亮度值（0-1）
 */
export function getColorBrightness(color: ColorType): number {
  const rgb = colorMap[color];
  // 使用相对亮度公式
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

/**
 * 生成互补色（对比色）
 * @param color 原始颜色
 * @returns 互补色的十六进制值
 */
export function getComplementaryColor(color: ColorType): string {
  const rgb = colorMap[color];
  const complementary: [number, number, number] = [
    255 - rgb[0],
    255 - rgb[1],
    255 - rgb[2],
  ];
  return rgbToHex(...complementary);
}
