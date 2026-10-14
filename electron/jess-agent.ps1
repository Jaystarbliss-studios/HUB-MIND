$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class JessWin32 {
 public delegate bool EnumWindowsProc(IntPtr h,IntPtr lp);
 [StructLayout(LayoutKind.Sequential)] public struct RECT{public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct INPUT{public uint type;public InputUnion U;}
 [StructLayout(LayoutKind.Explicit)] public struct InputUnion{[FieldOffset(0)]public KEYBDINPUT ki;[FieldOffset(0)]public MOUSEINPUT mi;}
 [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT{public ushort vk,scan;public uint flags,time;public IntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT{public int dx,dy;public uint data,flags,time;public IntPtr extra;}
 [DllImport("user32.dll")]public static extern bool EnumWindows(EnumWindowsProc cb,IntPtr lp);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,System.Text.StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern bool BringWindowToTop(IntPtr h);
 [DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);
 [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
 [DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool repaint);
 [DllImport("user32.dll")]public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")]public static extern bool IsZoomed(IntPtr h);
 [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint data,UIntPtr extra);
 [DllImport("user32.dll")]public static extern uint SendInput(uint n,INPUT[] i,int size);
 public const uint KEYUP=2,UNICODE=4,EXTENDED=1;
 public static bool SendVirtualKeys(ushort[] keys,int holdMs) {
  if(keys==null||keys.Length==0) return false;
  var inputs=new INPUT[keys.Length*2];
  for(int i=0;i<keys.Length;i++){
   uint flags=(keys[i]==33||keys[i]==34||keys[i]==35||keys[i]==36||keys[i]==37||keys[i]==38||keys[i]==39||keys[i]==40||keys[i]==45||keys[i]==46||keys[i]==91||keys[i]==92||keys[i]==144||keys[i]==145||keys[i]>=173&&keys[i]<=179)?EXTENDED:0;
   inputs[i]=new INPUT();inputs[i].type=1;inputs[i].U.ki=new KEYBDINPUT{vk=keys[i],scan=0,flags=flags,time=0,extra=IntPtr.Zero};
  }
  System.Threading.Thread.Sleep(Math.Max(0,Math.Min(5000,holdMs)));
  for(int i=0;i<keys.Length;i++){
   ushort key=keys[keys.Length-1-i];
   uint flags=KEYUP;
   if(key==33||key==34||key==35||key==36||key==37||key==38||key==39||key==40||key==45||key==46||key==91||key==92||key==144||key==145||key>=173&&key<=179) flags|=EXTENDED;
   inputs[keys.Length+i]=new INPUT();inputs[keys.Length+i].type=1;inputs[keys.Length+i].U.ki=new KEYBDINPUT{vk=key,scan=0,flags=flags,time=0,extra=IntPtr.Zero};
  }
  return SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(INPUT)))==inputs.Length;
 }
}
'@
function Get-Windows {
 $items=New-Object System.Collections.Generic.List[object]
 $cb=[JessWin32+EnumWindowsProc]{param([IntPtr]$h,[IntPtr]$lp)
  if(-not [JessWin32]::IsWindowVisible($h)){return $true}
  $sb=New-Object System.Text.StringBuilder 1024;[void][JessWin32]::GetWindowText($h,$sb,$sb.Capacity);$title=$sb.ToString().Trim();if(!$title){return $true}
  $processId=[uint32]0;[void][JessWin32]::GetWindowThreadProcessId($h,[ref]$processId);$r=New-Object JessWin32+RECT;[void][JessWin32]::GetWindowRect($h,[ref]$r);$proc='';try{$proc=(Get-Process -Id $processId -ErrorAction Stop).ProcessName}catch{}
  $items.Add([pscustomobject]@{handle=$h.ToInt64();title=$title;process=$proc;pid=$processId;bounds=@{x=$r.Left;y=$r.Top;width=$r.Right-$r.Left;height=$r.Bottom-$r.Top};state=$(if([JessWin32]::IsIconic($h)){'minimized'}elseif([JessWin32]::IsZoomed($h)){'maximized'}else{'normal'});foreground=($h -eq [JessWin32]::GetForegroundWindow())});return $true
 }
 [void][JessWin32]::EnumWindows($cb,[IntPtr]::Zero);return @($items)
}
function Find-Window($a){
 $ws=Get-Windows
 if($null -ne $a.handle -and [string]$a.handle -ne ''){
  $handleMatches=@($ws|Where-Object{[string]$_.handle -eq [string]$a.handle})
  if($handleMatches.Count -eq 1){return $handleMatches[0]}
  return $null
 }
 if($a.title){
  $needle=[string]$a.title
  $exact=@($ws|Where-Object{[string]::Equals([string]$_.title,$needle,[StringComparison]::OrdinalIgnoreCase)})
  if($exact.Count -eq 1){return $exact[0]}
  if($exact.Count -gt 1){throw 'Window title is ambiguous; provide the exact window handle.'}
  $titleMatches=@($ws|Where-Object{$_.title.IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0})
  if($titleMatches.Count -eq 1){return $titleMatches[0]}
  if($titleMatches.Count -gt 1){throw 'Window title is ambiguous; provide the exact window handle.'}
 }
 return $null
}
function Send-Key($key, $holdMs = 45){
  $map=@{ENTER=13;ESC=27;TAB=9;SPACE=32;BACKSPACE=8;DELETE=46;INSERT=45;HOME=36;END=35;PAGEUP=33;PAGEDOWN=34;UP=38;DOWN=40;LEFT=37;RIGHT=39;CTRL=17;ALT=18;SHIFT=16;WIN=91;F1=112;F2=113;F3=114;F4=115;F5=116;F6=117;F7=118;F8=119;F9=120;F10=121;F11=122;F12=123;F13=124;F14=125;F15=126;F16=127;F17=128;F18=129;F19=130;F20=131;F21=132;F22=133;F23=134;F24=135;VOLUME_MUTE=173;VOLUME_DOWN=174;VOLUME_UP=175;MEDIA_NEXT=176;MEDIA_PREVIOUS=177;MEDIA_STOP=178;MEDIA_PLAY_PAUSE=179}
  $vks=New-Object System.Collections.Generic.List[uint16];foreach($p in $key.ToUpperInvariant().Split('+')){$v=$map[$p];if(!$v -and $p.Length -eq 1){$v=[int][char]$p};if(!$v){throw ('Unsupported key '+$p)};$vks.Add([uint16]$v)}
  $ok=[JessWin32]::SendVirtualKeys($vks.ToArray(),[Math]::Max(0,[Math]::Min(5000,[int]$holdMs)))
  if(-not $ok){throw 'Windows SendInput did not accept the complete key sequence.'}
}
function Invoke-Action($q){
 $a=$q.args
 switch($q.method){
 'list_windows' {return @{ok=$true;verified=$true;evidence=(Get-Windows)}}
 'focus_window' {$w=Find-Window $a;if(!$w){throw 'Window not found'};[void][JessWin32]::ShowWindowAsync([IntPtr]$w.handle,9);[void][JessWin32]::BringWindowToTop([IntPtr]$w.handle);[void][JessWin32]::SetForegroundWindow([IntPtr]$w.handle);Start-Sleep -Milliseconds 250;$ok=([JessWin32]::GetForegroundWindow().ToInt64() -eq [int64]$w.handle);return @{ok=$ok;verified=$ok;evidence=@{window=$w;foreground=([JessWin32]::GetForegroundWindow().ToInt64())}}}
 {$_ -in 'close_window','minimize_window','maximize_window','restore_window','move_window','resize_window','snap_window'} {$w=Find-Window $a;if(!$w){throw 'Window not found'};$h=[IntPtr]$w.handle;switch($q.method){'close_window'{[void][JessWin32]::PostMessage($h,0x0010,[IntPtr]::Zero,[IntPtr]::Zero);Start-Sleep -Milliseconds 300;$exists=[JessWin32]::IsWindow($h);return @{ok=(-not $exists);verified=(-not $exists);evidence=@{window=$w;windowHandleStillExists=$exists}}}'minimize_window'{[void][JessWin32]::ShowWindowAsync($h,6)}'maximize_window'{[void][JessWin32]::ShowWindowAsync($h,3)}'restore_window'{[void][JessWin32]::ShowWindowAsync($h,9)}default{$r=$w.bounds;$x=[int]$r.x;$y=[int]$r.y;$ww=[int]$r.width;$hh=[int]$r.height;if($q.method -eq 'move_window'){$x=[int]$a.x;$y=[int]$a.y};if($q.method -eq 'resize_window'){$ww=[Math]::Max(200,[int]$a.width);$hh=[Math]::Max(150,[int]$a.height)};if($q.method -eq 'snap_window'){Add-Type -AssemblyName System.Windows.Forms;$area=[System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea;switch([string]$a.position){'left'{$x=$area.X;$y=$area.Y;$ww=[int]($area.Width/2);$hh=$area.Height}'right'{$x=$area.X+[int]($area.Width/2);$y=$area.Y;$ww=[int]($area.Width/2);$hh=$area.Height}'top-right'{$x=$area.X+[int]($area.Width/2);$y=$area.Y;$ww=[int]($area.Width/2);$hh=[int]($area.Height/2)}'top-left'{$x=$area.X;$y=$area.Y;$ww=[int]($area.Width/2);$hh=[int]($area.Height/2)}'bottom-right'{$x=$area.X+[int]($area.Width/2);$y=$area.Y+[int]($area.Height/2);$ww=[int]($area.Width/2);$hh=[int]($area.Height/2)}'bottom-left'{$x=$area.X;$y=$area.Y+[int]($area.Height/2);$ww=[int]($area.Width/2);$hh=[int]($area.Height/2)}default{throw 'Unsupported snap position'}}};[void][JessWin32]::ShowWindowAsync($h,9);if(-not [JessWin32]::MoveWindow($h,$x,$y,$ww,$hh,$true)){throw 'MoveWindow failed'}}};Start-Sleep -Milliseconds 180;$after=Find-Window @{handle=$w.handle};$verified=$false;if($after){switch($q.method){'minimize_window'{$verified=$after.state -eq 'minimized'}'maximize_window'{$verified=$after.state -eq 'maximized'}'restore_window'{$verified=$after.state -ne 'minimized'}'move_window'{$verified=([Math]::Abs([int]$after.bounds.x-[int]$a.x) -le 4 -and [Math]::Abs([int]$after.bounds.y-[int]$a.y) -le 4)}'resize_window'{$verified=([Math]::Abs([int]$after.bounds.width-[int]$a.width) -le 12 -and [Math]::Abs([int]$after.bounds.height-[int]$a.height) -le 12)}'snap_window'{$verified=([Math]::Abs([int]$after.bounds.width-[int]$ww) -le 12 -and [Math]::Abs([int]$after.bounds.height-[int]$hh) -le 12)}}};return @{ok=$verified;verified=$verified;evidence=@{before=$w;after=$after;expected=@{x=$x;y=$y;width=$ww;height=$hh}}}}
 'mouse_move' {[void][JessWin32]::SetCursorPos([int]$a.x,[int]$a.y);return @{ok=$true;verified=$true;evidence=@{x=$a.x;y=$a.y;note='Cursor position requested'}}}
 {$_ -in 'click','double_click','right_click'} {[void][JessWin32]::SetCursorPos([int]$a.x,[int]$a.y);$down=2;$up=4;if($q.method -eq 'right_click'){$down=8;$up=16};$count=1;if($q.method -eq 'double_click'){$count=2};1..$count|ForEach-Object{[JessWin32]::mouse_event($down,0,0,0,[UIntPtr]::Zero);[JessWin32]::mouse_event($up,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 70};return @{ok=$true;verified=$false;evidence=@{x=$a.x;y=$a.y;note='Input injected; UI effect not independently confirmed'}}}
 'scroll' {$delta=[int]$a.delta;$wheelData=[BitConverter]::ToUInt32([BitConverter]::GetBytes($delta),0);[void][JessWin32]::SetCursorPos([int]$a.x,[int]$a.y);[JessWin32]::mouse_event(0x0800,0,0,$wheelData,[UIntPtr]::Zero);if($null -ne $a.horizontalDelta -and [int]$a.horizontalDelta -ne 0){$horizontal=[BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$a.horizontalDelta),0);[JessWin32]::mouse_event(0x1000,0,0,$horizontal,[UIntPtr]::Zero)};return @{ok=$true;verified=$false;evidence=@{x=$a.x;y=$a.y;delta=$delta;horizontalDelta=[int]$a.horizontalDelta}}}
 'drag' {[void][JessWin32]::SetCursorPos([int]$a.fromX,[int]$a.fromY);[JessWin32]::mouse_event(2,0,0,0,[UIntPtr]::Zero);$steps=12;for($i=1;$i -le $steps;$i++){$x=[int]($a.fromX+($a.toX-$a.fromX)*$i/$steps);$y=[int]($a.fromY+($a.toY-$a.fromY)*$i/$steps);[void][JessWin32]::SetCursorPos($x,$y);Start-Sleep -Milliseconds 12};[JessWin32]::mouse_event(4,0,0,0,[UIntPtr]::Zero);return @{ok=$true;verified=$false;evidence=@{from=@{x=$a.fromX;y=$a.fromY};to=@{x=$a.toX;y=$a.toY};note='Drag input sent; target effect not independently confirmed'}}}
 'type_text' {$text=[string]$a.text;if($text.Length -gt 10000){throw 'Text limited to 10,000 characters'};foreach($ch in $text.ToCharArray()){$i=New-Object JessWin32+INPUT;$i.type=1;$i.U.ki.scan=[uint16][char]$ch;$i.U.ki.flags=4;$up=$i;$up.U.ki.flags=6;$arr=@($i,$up);[void][JessWin32]::SendInput(2,$arr,[Runtime.InteropServices.Marshal]::SizeOf([type][JessWin32+INPUT]))};return @{ok=$true;verified=$false;evidence=@{characters=$text.Length;note='Unicode input sent; field content not independently verified'}}}
 'press_keys' {$hold=45;if($null -ne $a.holdMs){$hold=[int]$a.holdMs};Send-Key ([string]$a.keys) $hold;return @{ok=$true;verified=$false;evidence=@{keys=$a.keys;holdMs=$hold;note='C# SendInput accepted the key down/up sequence; target effect requires a screen or UI readback'}}}
 'media_key' {$action=[string]$a.action;$map=@{volume_up=175;volume_down=174;volume_mute=173;brightness_up=111;brightness_down=112};if(!$map.ContainsKey($action)){throw 'Unsupported media or brightness key'};$vk=[uint16]$map[$action];$down=New-Object JessWin32+INPUT;$down.type=1;$down.U.ki.vk=$vk;$up=New-Object JessWin32+INPUT;$up.type=1;$up.U.ki.vk=$vk;$up.U.ki.flags=[JessWin32]::KEYUP;$arr=@($down,$up);[void][JessWin32]::SendInput(2,$arr,[Runtime.InteropServices.Marshal]::SizeOf([type][JessWin32+INPUT]));return @{ok=$true;verified=$false;evidence=@{action=$action;virtualKey=$vk;note='Windows media/brightness key event sent. Some keyboards, display drivers or external monitors may not expose this control; read the actual system state to verify.'}}}
 'find_ui_element' {$name=[string]$a.name;if(!$name){throw 'Element name required'};$root=[System.Windows.Automation.AutomationElement]::RootElement;$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsControlElementProperty,$true);$all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$cond);$matches=@();for($i=0;$i -lt [Math]::Min($all.Count,3000);$i++){try{$e=$all.Item($i);if($e.Current.Name -like ('*'+$name+'*')){$r=$e.Current.BoundingRectangle;$matches+=@{name=$e.Current.Name;automationId=$e.Current.AutomationId;controlType=$e.Current.ControlType.ProgrammaticName;bounds=@{x=$r.X;y=$r.Y;width=$r.Width;height=$r.Height}};if($matches.Count -ge 20){break}}}catch{}};return @{ok=$true;verified=($matches.Count -gt 0);evidence=@{query=$name;matches=$matches}}}
 'invoke_ui_element' {$name=[string]$a.name;if(!$name){throw 'Element name required'};$root=[System.Windows.Automation.AutomationElement]::RootElement;$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsControlElementProperty,$true);$all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$cond);$target=$null;for($i=0;$i -lt [Math]::Min($all.Count,3000);$i++){try{$e=$all.Item($i);if($e.Current.Name -eq $name -or $e.Current.Name -like ('*'+$name+'*')){$target=$e;break}}catch{}};if(!$target){throw ('No accessible UI element found matching '+$name)};try{$pattern=$target.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern);$pattern.Invoke();Start-Sleep -Milliseconds 150;return @{ok=$true;verified=$false;evidence=@{name=$target.Current.Name;automationId=$target.Current.AutomationId;note='InvokePattern called; resulting UI state needs a follow-up screenshot or screen read'}}}catch{throw ('Element does not support InvokePattern: '+$target.Current.Name)}}
 'read_screen_text' {$root=[System.Windows.Automation.AutomationElement]::RootElement;$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsControlElementProperty,$true);$all=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$cond);$lines=New-Object System.Collections.Generic.List[string];for($i=0;$i -lt [Math]::Min($all.Count,2500);$i++){try{$name=$all.Item($i).Current.Name;if($name){$lines.Add($name)}}catch{}};$text=$lines -join [Environment]::NewLine;return @{ok=$true;verified=($text.Length -gt 0);evidence=@{text=$text.Substring(0,[Math]::Min(20000,$text.Length));source='Windows UI Automation';elements=$lines.Count}}}
 'screenshot' {Add-Type -AssemblyName System.Windows.Forms;$result=@();foreach($s in [System.Windows.Forms.Screen]::AllScreens){$b=$s.Bounds;$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height);$g=[System.Drawing.Graphics]::FromImage($bmp);$g.CopyFromScreen($b.X,$b.Y,0,0,$bmp.Size);$ms=New-Object System.IO.MemoryStream;$bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Jpeg);$result+=@{monitor=$s.DeviceName;bounds=@{x=$b.X;y=$b.Y;width=$b.Width;height=$b.Height};primary=$s.Primary;imageBase64=[Convert]::ToBase64String($ms.ToArray())};$g.Dispose();$bmp.Dispose();$ms.Dispose()};return @{ok=$true;verified=($result.Count -gt 0);evidence=@{monitors=$result}}}
 'get_time' {return @{ok=$true;verified=$true;evidence=@{localTime=(Get-Date).ToString('o');timeZone=[TimeZoneInfo]::Local.Id}}}
 'system_info' {return @{ok=$true;verified=$true;evidence=@{computer=$env:COMPUTERNAME;user=$env:USERNAME;os=[Environment]::OSVersion.VersionString;architecture=$env:PROCESSOR_ARCHITECTURE}}}
 'launch_app' {$name=[string]$a.name;if($name -match '[\r\n;&|<>]'){throw 'Invalid application name'};$app=Get-StartApps|Where-Object{$_.Name -like ('*'+$name+'*') -or $_.AppID -like ('*'+$name+'*')}|Select-Object -First 1;if($app){Start-Process explorer.exe -ArgumentList ('shell:AppsFolder\'+$app.AppID);Start-Sleep -Milliseconds 500;$w=Get-Windows|Where-Object{$_.title -like ('*'+$name+'*')}|Select-Object -First 1;return @{ok=$true;verified=($null -ne $w);evidence=@{app=$app;window=$w}}};$cmd=Get-Command $name -ErrorAction SilentlyContinue;if($cmd){Start-Process -FilePath $cmd.Source;Start-Sleep -Milliseconds 500;$w=Get-Windows|Where-Object{$_.process -like ('*'+$name+'*')}|Select-Object -First 1;return @{ok=$true;verified=($null -ne $w);evidence=@{command=$cmd.Source;window=$w}}};throw ('Could not resolve installed app '+$name)}
 'open_path' {$target=[string]$a.path;if(!$target -or $target.Length -gt 2048 -or $target.Contains([char]0)){throw 'Invalid file path'};$resolved=[System.IO.Path]::GetFullPath($target);if(!(Test-Path -LiteralPath $resolved)){throw 'File or folder does not exist'};$leaf=[System.IO.Path]::GetFileName($resolved);$before=@(Get-Windows|ForEach-Object{[string]$_.handle});Start-Process -FilePath $resolved;Start-Sleep -Milliseconds 700;$after=Get-Windows;$new=$after|Where-Object{($before -notcontains [string]$_.handle) -or ($leaf -and $_.title -like ('*'+$leaf+'*'))}|Select-Object -First 1;if($new){[void][JessWin32]::ShowWindowAsync([IntPtr]$new.handle,9);[void][JessWin32]::SetForegroundWindow([IntPtr]$new.handle);Start-Sleep -Milliseconds 120};$verified=($null -ne $new -and [JessWin32]::GetForegroundWindow().ToInt64() -eq [int64]$new.handle);return @{ok=($null -ne $new);verified=$verified;evidence=@{path=$resolved;window=$new;note='Default Windows handler was invoked; visibility verification depends on a matching window'}}}
 'run_command' {$command=[string]$a.command;if($command.Length -gt 4000){throw 'Command limited to 4,000 characters'};$blocked='(?i)\b(remove-item|format-volume|format-disk|clear-disk|diskpart|bcdedit|shutdown|restart-computer|stop-computer|set-executionpolicy|reg\s+delete|cipher\s+/w)\b';if($command -match $blocked){throw 'Potentially destructive command blocked'};$out=& powershell.exe -NoLogo -NoProfile -NonInteractive -Command $command 2>&1|Out-String;return @{ok=($LASTEXITCODE -eq 0);verified=$false;evidence=@{output=$out.Substring(0,[Math]::Min(12000,$out.Length));exitCode=$LASTEXITCODE;note='Output captured; side effects not independently verified'}}}
 default {throw ('Unknown method: '+$q.method)}
 }
}
while($true){$line=[Console]::ReadLine();if($null -eq $line){break};try{$q=ConvertFrom-Json $line;$r=Invoke-Action $q;$o=@{id=$q.id;result=$r}}catch{$o=@{id=$q.id;result=@{ok=$false;verified=$false;evidence=$null;error=$_.Exception.Message}}};try{[Console]::Out.WriteLine((ConvertTo-Json -InputObject $o -Depth 12 -Compress));[Console]::Out.Flush()}catch{}}
