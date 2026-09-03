import { parseDocument } from "htmlparser2";

export interface XmlNode {
  type: string;
  data?: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: XmlNode[];
}

export function parseXml(source: string): XmlNode {
  return parseDocument(source, { xmlMode: true, decodeEntities: true }) as unknown as XmlNode;
}

export function xmlElements(node: XmlNode, wantedLocalName?: string): XmlNode[] {
  const wanted = wantedLocalName?.toLowerCase();
  const found: XmlNode[] = [];
  for (const child of node.children ?? []) {
    if (!isXmlElement(child)) continue;
    if (!wanted || localName(child.name) === wanted) found.push(child);
    found.push(...xmlElements(child, wantedLocalName));
  }
  return found;
}

export function xmlChildren(node: XmlNode, wantedLocalName?: string): XmlNode[] {
  const wanted = wantedLocalName?.toLowerCase();
  return (node.children ?? []).filter((child) => isXmlElement(child) && (!wanted || localName(child.name) === wanted));
}

export function xmlFirst(node: XmlNode, wantedLocalName: string): XmlNode | undefined {
  return xmlElements(node, wantedLocalName)[0];
}

export function xmlAttribute(node: XmlNode | undefined, name: string): string | undefined {
  if (!node) return undefined;
  const exact = node.attribs?.[name];
  if (exact !== undefined) return exact;
  const wanted = localName(name);
  const entry = Object.entries(node.attribs ?? {}).find(([key]) => localName(key) === wanted);
  return entry?.[1];
}

export function xmlText(node: XmlNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.data ?? "";
  return (node.children ?? []).map(xmlText).join("");
}

export function localName(name: string | undefined): string {
  return (name ?? "").split(":").at(-1)!.toLowerCase();
}

export function isXmlElement(node: XmlNode): boolean {
  return node.type === "tag" && typeof node.name === "string";
}
