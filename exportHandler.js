/**
 * ExportHandler — Export as PNG (with embedded JSON), JSON, or copy-as-image
 */
const ExportHandler = (() => {
    let html2canvasLoaded = false;

    function loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (html2canvasLoaded) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = () => { html2canvasLoaded = true; resolve(); };
            script.onerror = () => reject(new Error('无法加载 html2canvas'));
            document.head.appendChild(script);
        });
    }

    // --- Build SillyTavern v2 spec JSON ---
    function buildCharacterJSON(formData) {
        return {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: formData.name || '',
                description: formData.description || '',
                personality: formData.personality || '',
                first_mes: formData.first_mes || '',
                mes_example: formData.mes_example || '',
                scenario: formData.scenario || '',
                creator_notes: formData.creator_notes || '',
                system_prompt: formData.system_prompt || '',
                post_history_instructions: formData.post_history_instructions || '',
                tags: formData.tags || [],
                creator: formData.creator || '',
                character_version: formData.version || '',
                alternate_greetings: [],
                extensions: {}
            }
        };
    }

    // --- Export as JSON ---
    function exportJSON(formData) {
        const json = buildCharacterJSON(formData);
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const name = safeName(formData.name);
        downloadBlob(blob, name + '.json');
        Toast.show('JSON 导出成功', 'success');
    }

    // --- Export as PNG with embedded JSON ---
    async function exportPNG(formData) {
        try {
            Toast.show('正在生成卡片图片…', 'info');
            await loadHtml2Canvas();

            const cardEl = CardRenderer.getCardElement();
            if (!cardEl) {
                Toast.show('请先填写角色信息', 'warning');
                return;
            }

            const canvas = await html2canvas(cardEl, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                logging: false
            });

            const json = buildCharacterJSON(formData);
            const jsonStr = JSON.stringify(json);
            const base64Json = btoa(unescape(encodeURIComponent(jsonStr)));

            const pngData = canvas.toDataURL('image/png');
            const pngBlob = await embedTextChunkInPNG(pngData, 'chara', base64Json);

            const name = safeName(formData.name);
            downloadBlob(pngBlob, name + '.png');
            Toast.show('PNG 角色卡导出成功', 'success');
        } catch (err) {
            console.error('Export PNG error:', err);
            Toast.show('导出失败: ' + err.message, 'error');
        }
    }

    // --- Copy card as image to clipboard ---
    async function copyAsImage() {
        try {
            await loadHtml2Canvas();
            const cardEl = CardRenderer.getCardElement();
            if (!cardEl) {
                Toast.show('请先填写角色信息', 'warning');
                return;
            }

            const canvas = await html2canvas(cardEl, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                logging: false
            });

            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    Toast.show('已复制到剪贴板', 'success');
                } catch (e) {
                    Toast.show('复制失败，浏览器不支持', 'warning');
                }
            }, 'image/png');
        } catch (err) {
            Toast.show('生成图片失败', 'error');
        }
    }

    // --- Import from JSON or PNG ---
    async function importFile(file) {
        if (!file) return null;
        if (file.name.endsWith('.json')) return importJSON(file);
        if (file.name.endsWith('.png')) return importPNG(file);
        Toast.show('不支持的文件格式', 'error');
        return null;
    }

    function importJSON(file) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var json = JSON.parse(e.target.result);
                    var data = extractCharaData(json);
                    if (data) {
                        Toast.show('JSON 导入成功', 'success');
                        resolve(data);
                    } else {
                        Toast.show('无效的角色卡 JSON', 'error');
                        resolve(null);
                    }
                } catch (err) {
                    Toast.show('JSON 解析失败', 'error');
                    resolve(null);
                }
            };
            reader.readAsText(file);
        });
    }

    function importPNG(file) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var bytes = new Uint8Array(e.target.result);
                    var textChunk = extractTextChunkFromPNG(bytes, 'chara');
                    if (textChunk) {
                        var jsonStr = decodeURIComponent(escape(atob(textChunk)));
                        var json = JSON.parse(jsonStr);
                        var data = extractCharaData(json);
                        if (data) {
                            Toast.show('PNG 角色卡导入成功', 'success');
                            resolve(data);
                            return;
                        }
                    }
                    Toast.show('未找到嵌入的角色数据', 'error');
                    resolve(null);
                } catch (err) {
                    Toast.show('PNG 解析失败', 'error');
                    resolve(null);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function extractCharaData(json) {
        var src = (json.spec === 'chara_card_v2' && json.data) ? json.data : json;
        if (!src.name && !src.description) return null;
        return {
            name: src.name || '',
            description: src.description || '',
            personality: src.personality || '',
            first_mes: src.first_mes || '',
            mes_example: src.mes_example || '',
            scenario: src.scenario || '',
            creator_notes: src.creator_notes || '',
            system_prompt: src.system_prompt || '',
            post_history_instructions: src.post_history_instructions || '',
            tags: src.tags || [],
            creator: src.creator || '',
            version: src.character_version || '',
            title: '',
            avatar: null
        };
    }

    // ========== PNG Binary Helpers ==========

    async function embedTextChunkInPNG(dataUrl, keyword, text) {
        var base64 = dataUrl.split(',')[1];
        var binaryStr = atob(base64);
        var bytes = new Uint8Array(binaryStr.length);
        for (var i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        var iendPos = -1;
        var pos = 8;
        while (pos < bytes.length) {
            var len = readU32(bytes, pos);
            var type = String.fromCharCode(bytes[pos+4], bytes[pos+5], bytes[pos+6], bytes[pos+7]);
            if (type === 'IEND') { iendPos = pos; break; }
            pos += 12 + len;
        }
        if (iendPos === -1) return dataUrlToBlob(dataUrl);

        var keyBytes = new TextEncoder().encode(keyword);
        var valBytes = new TextEncoder().encode(text);
        var chunkData = new Uint8Array(keyBytes.length + 1 + valBytes.length);
        chunkData.set(keyBytes, 0);
        chunkData[keyBytes.length] = 0;
        chunkData.set(valBytes, keyBytes.length + 1);

        var typeBytes = new Uint8Array([0x74, 0x45, 0x58, 0x74]);
        var lenBytes = new Uint8Array(4);
        writeU32(lenBytes, 0, chunkData.length);

        var crcInput = concatArr([typeBytes, chunkData]);
        var crcBytes = new Uint8Array(4);
        writeU32(crcBytes, 0, crc32(crcInput));

        var beforeIend = bytes.slice(0, iendPos);
        var iendChunk = bytes.slice(iendPos);
        var textChunk = concatArr([lenBytes, typeBytes, chunkData, crcBytes]);
        return new Blob([concatArr([beforeIend, textChunk, iendChunk])], { type: 'image/png' });
    }

    function extractTextChunkFromPNG(bytes, keyword) {
        var pos = 8;
        while (pos < bytes.length) {
            var len = readU32(bytes, pos);
            var type = String.fromCharCode(bytes[pos+4], bytes[pos+5], bytes[pos+6], bytes[pos+7]);
            if (type === 'tEXt') {
                var data = bytes.slice(pos + 8, pos + 8 + len);
                var nullIdx = -1;
                for (var j = 0; j < data.length; j++) {
                    if (data[j] === 0) { nullIdx = j; break; }
                }
                if (nullIdx >= 0) {
                    var key = new TextDecoder().decode(data.slice(0, nullIdx));
                    if (key === keyword) return new TextDecoder().decode(data.slice(nullIdx + 1));
                }
            }
            if (type === 'IEND') break;
            pos += 12 + len;
        }
        return null;
    }

    function readU32(a, o) {
        return ((a[o] << 24) | (a[o+1] << 16) | (a[o+2] << 8) | a[o+3]) >>> 0;
    }

    function writeU32(a, o, v) {
        a[o] = (v >>> 24) & 0xFF;
        a[o+1] = (v >>> 16) & 0xFF;
        a[o+2] = (v >>> 8) & 0xFF;
        a[o+3] = v & 0xFF;
    }

    function concatArr(arrays) {
        var totalLen = 0;
        for (var i = 0; i < arrays.length; i++) totalLen += arrays[i].length;
        var r = new Uint8Array(totalLen);
        var off = 0;
        for (var j = 0; j < arrays.length; j++) {
            r.set(arrays[j], off);
            off += arrays[j].length;
        }
        return r;
    }

    function dataUrlToBlob(url) {
        var parts = url.split(',');
        var mime = parts[0].match(/:(.*?);/)[1];
        var b = atob(parts[1]);
        var a = new Uint8Array(b.length);
        for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
        return new Blob([a], { type: mime });
    }

    var crc32Table = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c;
        }
        return t;
    })();

    function crc32(data) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < data.length; i++) c = crc32Table[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function safeName(name) {
        return (name || 'character').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    }

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return { exportJSON: exportJSON, exportPNG: exportPNG, copyAsImage: copyAsImage, importFile: importFile };
})();
