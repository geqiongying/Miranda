# MIRANDA · 操盘台

Miranda 的私人操盘学习站：按均线教学规则筛观察池，并用问答窗判断适不适合买卖。

线上地址（合并 `main` 并由 GitHub Pages 发布后）：

`https://geqiongying.github.io/Miranda/`

## 功能

1. **规则选股观察池**：对关注池 / 主线样本做买点 A/B/C + 买入闸门打分  
2. **买卖问答窗**：输入代码或「适不适合买/卖」，给出结论、持仓建议与价格带  
3. **规则说明**：当前引擎使用的模板速览；录像精读后会继续加深

## 重要说明

- 页面显示的是 **规则契合度**，不是胜率  
- **不承诺、也不暗示 90% 成功率**  
- 仅供个人学习参考，不构成投资建议

## 视频怎么接入

百度网盘链接 Cloud Agent 通常下不下来。请把视频放到：

- 仓库目录 `videos/`（小文件），或  
- [GitHub Releases](https://github.com/geqiongying/Miranda/releases)（大文件）

然后在对话里告诉路径，即可继续按录像精炼规则。

## 本地预览

```bash
python3 -m http.server 4173
```

打开：http://localhost:4173
