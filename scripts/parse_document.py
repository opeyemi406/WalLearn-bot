#!/usr/bin/env python3
import sys
import os
import json
import io
import zipfile
import xml.etree.ElementTree as ET

def extract_pdf(data_bytes):
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(data_bytes))
    pages_text = []
    for i, page in enumerate(reader.pages):
        try:
            txt = page.extract_text() or ""
            if txt.strip():
                pages_text.append(f"--- Slide/Page {i+1} ---\n" + txt.strip())
        except Exception:
            continue
    full_text = "\n\n".join(pages_text)
    return full_text, len(reader.pages)

def extract_pptx(data_bytes):
    zf = zipfile.ZipFile(io.BytesIO(data_bytes))
    slides_text = []
    slide_files = sorted([f for f in zf.namelist() if f.startswith("ppt/slides/slide") and f.endswith(".xml")])
    for i, s_file in enumerate(slide_files):
        try:
            xml_content = zf.read(s_file)
            tree = ET.fromstring(xml_content)
            texts = [node.text for node in tree.iter() if node.text and node.text.strip()]
            if texts:
                slides_text.append(f"--- Slide {i+1} ---\n" + " ".join(texts))
        except Exception:
            continue
    full_text = "\n\n".join(slides_text)
    return full_text, len(slide_files)

def extract_docx(data_bytes):
    zf = zipfile.ZipFile(io.BytesIO(data_bytes))
    xml_content = zf.read("word/document.xml")
    tree = ET.fromstring(xml_content)
    texts = [node.text for node in tree.iter() if node.text and node.text.strip()]
    return "\n\n".join(texts), 1

def main():
    if len(sys.argv) < 2:
        ext = "pdf"
    else:
        ext = sys.argv[1].lower().strip(".")

    try:
        input_data = sys.stdin.buffer.read()
        if not input_data:
            print(json.dumps({"success": False, "error": "No data received on stdin"}))
            return

        if ext == "pdf":
            text, pages = extract_pdf(input_data)
        elif ext in ["pptx", "ppt"]:
            text, pages = extract_pptx(input_data)
        elif ext in ["docx", "doc"]:
            text, pages = extract_docx(input_data)
        elif ext in ["txt", "md", "csv", "json", "rtf"]:
            text = input_data.decode("utf-8", errors="replace")
            pages = 1
        else:
            # Fallback to UTF-8 text or try PDF
            try:
                text, pages = extract_pdf(input_data)
            except Exception:
                text = input_data.decode("utf-8", errors="replace")
                pages = 1

        # Clean excessive whitespace
        text = text.replace("\r\n", "\n").strip()
        print(json.dumps({"success": True, "text": text, "pages": pages, "ext": ext}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
